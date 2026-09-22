"""Persistent render lifecycle event journal."""
import os,sqlite3,json,uuid
from datetime import datetime,timezone
from pathlib import Path
DB_PATH=os.getenv("PHENOVA_RENDER_EVENTS_DB","/tmp/phenova_render_events.sqlite3")
def _db():
    Path(DB_PATH).parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DB_PATH,timeout=10,isolation_level=None)
    c.execute("CREATE TABLE IF NOT EXISTS render_events(id TEXT PRIMARY KEY,job_id TEXT NOT NULL,event TEXT NOT NULL,detail_json TEXT NOT NULL,created_at TEXT NOT NULL)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_render_events_job ON render_events(job_id,created_at)")
    return c
def record(job_id,event,detail=None):
    c=_db()
    try:c.execute("INSERT INTO render_events VALUES(?,?,?,?,?)",(str(uuid.uuid4()),str(job_id),str(event),json.dumps(detail or {},separators=(",",":")),datetime.now(timezone.utc).isoformat()))
    finally:c.close()
def recent(job_id,limit=50):
    c=_db()
    try:
        rows=c.execute("SELECT event,detail_json,created_at FROM render_events WHERE job_id=? ORDER BY created_at DESC LIMIT ?",(str(job_id),int(limit))).fetchall()
        return [{"event":e,"detail":json.loads(d),"created_at":t} for e,d,t in rows]
    finally:c.close()
