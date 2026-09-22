"""Versioned, persistent canonical timeline snapshots."""
import json, sqlite3, os
from datetime import datetime, timezone
from pathlib import Path
DB_PATH=os.getenv("PHENOVA_TIMELINE_DB","/tmp/phenova_timeline.sqlite3")

def _db():
    Path(DB_PATH).parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DB_PATH,timeout=10,isolation_level=None)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("""CREATE TABLE IF NOT EXISTS timeline_versions(
      project_id TEXT NOT NULL, version INTEGER NOT NULL,
      state_json TEXT NOT NULL, created_at TEXT NOT NULL,
      reason TEXT NOT NULL, PRIMARY KEY(project_id,version))""")
    return c

def save(project_id,state,reason="edit"):
    c=_db()
    try:
        c.execute("BEGIN IMMEDIATE")
        row=c.execute("SELECT COALESCE(MAX(version),0) FROM timeline_versions WHERE project_id=?",
                      (str(project_id),)).fetchone()
        version=int(row[0])+1
        c.execute("INSERT INTO timeline_versions VALUES(?,?,?,?,?)",
                  (str(project_id),version,json.dumps(state,separators=(",",":")),
                   datetime.now(timezone.utc).isoformat(),reason))
        c.execute("COMMIT"); return version
    except:
        try:c.execute("ROLLBACK")
        except:pass
        raise
    finally:c.close()

def latest(project_id):
    c=_db()
    try:
        row=c.execute("""SELECT version,state_json,created_at,reason
                         FROM timeline_versions WHERE project_id=?
                         ORDER BY version DESC LIMIT 1""",(str(project_id),)).fetchone()
        if not row:return None
        return {"version":row[0],"state":json.loads(row[1]),"created_at":row[2],"reason":row[3]}
    finally:c.close()
