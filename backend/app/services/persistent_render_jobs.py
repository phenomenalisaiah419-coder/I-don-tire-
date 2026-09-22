"""Persistent render-job registry with concurrency, heartbeat, retry and cleanup."""
import os, sqlite3, uuid, json
from datetime import datetime, timezone, timedelta
from pathlib import Path

DB_PATH=os.getenv("PHENOVA_RENDER_JOBS_DB","/tmp/phenova_render_jobs.sqlite3")
MAX_CONCURRENT=int(os.getenv("PHENOVA_MAX_CONCURRENT_RENDERS","1"))
MAX_RETRIES=int(os.getenv("PHENOVA_MAX_RENDER_RETRIES","2"))
STALE_SECONDS=int(os.getenv("PHENOVA_RENDER_STALE_SECONDS","900"))
TERMINAL={"COMPLETED","FAILED","CANCELLED"}
ACTIVE={"QUEUED","RUNNING","CANCELLING"}

def _db():
    Path(DB_PATH).parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DB_PATH,timeout=10,isolation_level=None)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("""CREATE TABLE IF NOT EXISTS render_jobs(
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL, status TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0, output_path TEXT,
      error TEXT, worker_id TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, started_at TEXT, finished_at TEXT,
      plan_json TEXT NOT NULL DEFAULT '{}')""")
    cols={r[1] for r in c.execute("PRAGMA table_info(render_jobs)").fetchall()}
    additions={
      "retry_count":"INTEGER NOT NULL DEFAULT 0",
      "heartbeat_at":"TEXT",
      "cancel_requested_at":"TEXT",
    }
    for col,definition in additions.items():
        if col not in cols:
            c.execute(f"ALTER TABLE render_jobs ADD COLUMN {col} {definition}")
    c.execute("CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status,created_at)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_render_jobs_heartbeat ON render_jobs(status,heartbeat_at)")
    return c

def now(): return datetime.now(timezone.utc).isoformat()

def create(account_id,plan,output_path):
    jid=str(uuid.uuid4()); t=now(); c=_db()
    try:
        c.execute("""INSERT INTO render_jobs
          (id,account_id,status,progress,output_path,error,worker_id,created_at,
           updated_at,started_at,finished_at,plan_json,retry_count,heartbeat_at,cancel_requested_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
          (jid,str(account_id),"QUEUED",0,output_path,None,None,t,t,None,None,
           json.dumps(plan,separators=(",",":"),ensure_ascii=False),0,None,None))
        return jid
    finally:c.close()

def get(job_id,account_id=None):
    c=_db()
    try:
        q="""SELECT id,account_id,status,progress,output_path,error,worker_id,
                    created_at,updated_at,started_at,finished_at,plan_json,
                    retry_count,heartbeat_at,cancel_requested_at
             FROM render_jobs WHERE id=?"""
        args=[job_id]
        if account_id is not None:q+=" AND account_id=?";args.append(str(account_id))
        r=c.execute(q,args).fetchone()
        if not r:return None
        keys=["id","account_id","status","progress","output_path","error","worker_id",
              "created_at","updated_at","started_at","finished_at","plan_json",
              "retry_count","heartbeat_at","cancel_requested_at"]
        item=dict(zip(keys,r))
        try:item["plan"]=json.loads(item.pop("plan_json"))
        except Exception:item["plan"]={}
        return item
    finally:c.close()

def claim(worker_id):
    c=_db()
    try:
        c.execute("BEGIN IMMEDIATE")
        active=c.execute("SELECT COUNT(*) FROM render_jobs WHERE status='RUNNING'").fetchone()[0]
        if active>=MAX_CONCURRENT:
            c.execute("COMMIT");return None
        r=c.execute("""SELECT id FROM render_jobs WHERE status='QUEUED'
                       ORDER BY created_at LIMIT 1""").fetchone()
        if not r:c.execute("COMMIT");return None
        jid=r[0];t=now()
        c.execute("""UPDATE render_jobs SET status='RUNNING',worker_id=?,
                     started_at=COALESCE(started_at,?),updated_at=?,heartbeat_at=?
                     WHERE id=? AND status='QUEUED'""",(worker_id,t,t,t,jid))
        c.execute("COMMIT");return jid
    except:
        try:c.execute("ROLLBACK")
        except:pass
        raise
    finally:c.close()

def update(job_id,**fields):
    allowed={"status","progress","output_path","error","worker_id","updated_at",
             "started_at","finished_at","heartbeat_at","retry_count"}
    fields={k:v for k,v in fields.items() if k in allowed}
    if not fields:return
    fields["updated_at"]=now()
    sets=", ".join(f"{k}=?" for k in fields)
    c=_db()
    try:c.execute(f"UPDATE render_jobs SET {sets} WHERE id=?",
                  [v for v in fields.values()]+[job_id])
    finally:c.close()

def heartbeat(job_id,worker_id):
    c=_db()
    try:
        c.execute("""UPDATE render_jobs SET heartbeat_at=?,updated_at=?
                     WHERE id=? AND worker_id=? AND status IN ('RUNNING','CANCELLING')""",
                  (now(),now(),job_id,worker_id))
        return c.total_changes>0
    finally:c.close()

def request_cancel(job_id,account_id):
    c=_db()
    try:
        c.execute("""UPDATE render_jobs SET status='CANCELLING',
                     cancel_requested_at=?,updated_at=?
                     WHERE id=? AND account_id=? AND status='RUNNING'""",
                  (now(),now(),job_id,str(account_id)))
        if c.total_changes:
            return True
        c.execute("""UPDATE render_jobs SET status='CANCELLED',
                     cancel_requested_at=?,updated_at=?,finished_at=?,error='RENDER_CANCELLED'
                     WHERE id=? AND account_id=? AND status='QUEUED'""",
                  (now(),now(),now(),job_id,str(account_id)))
        return c.total_changes>0
    finally:c.close()

def is_cancelling(job_id):
    c=_db()
    try:
        r=c.execute("SELECT status FROM render_jobs WHERE id=?",(job_id,)).fetchone()
        return bool(r and r[0]=="CANCELLING")
    finally:c.close()

def recover_stale(stale_seconds=STALE_SECONDS):
    cutoff=(datetime.now(timezone.utc)-timedelta(seconds=stale_seconds)).isoformat()
    c=_db()
    try:
        rows=c.execute("""SELECT id,retry_count FROM render_jobs
                         WHERE status IN ('RUNNING','CANCELLING')
                         AND (heartbeat_at<? OR updated_at<?)""",(cutoff,cutoff)).fetchall()
        recovered=0
        for jid,retries in rows:
            if int(retries or 0)<MAX_RETRIES:
                c.execute("""UPDATE render_jobs SET status='QUEUED',worker_id=NULL,
                             error='Recovered after worker interruption',updated_at=?,
                             retry_count=retry_count+1,heartbeat_at=NULL WHERE id=?""",
                          (now(),jid))
            else:
                c.execute("""UPDATE render_jobs SET status='FAILED',
                             error='Render exceeded automatic recovery attempts',
                             updated_at=?,finished_at=? WHERE id=?""",(now(),now(),jid))
            recovered+=1
        return recovered
    finally:c.close()

def cleanup(keep_terminal_days=7):
    cutoff=(datetime.now(timezone.utc)-timedelta(days=keep_terminal_days)).isoformat()
    c=_db()
    try:
        rows=c.execute("""SELECT id,output_path FROM render_jobs
                         WHERE status IN ('COMPLETED','FAILED','CANCELLED')
                         AND finished_at IS NOT NULL AND finished_at<?""",(cutoff,)).fetchall()
        for jid,path in rows:
            for candidate in (path, (path+".part" if path else None)):
                if candidate:
                    try:Path(candidate).unlink(missing_ok=True)
                    except OSError:pass
        c.execute("""DELETE FROM render_jobs WHERE status IN ('COMPLETED','FAILED','CANCELLED')
                     AND finished_at IS NOT NULL AND finished_at<?""",(cutoff,))
        return c.total_changes
    finally:c.close()

def queued_count():
    c=_db()
    try:return c.execute("SELECT COUNT(*) FROM render_jobs WHERE status='QUEUED'").fetchone()[0]
    finally:c.close()
