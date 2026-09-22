"""Atomic edit admission + creation reservation.

A daily slot is reserved and the edit record is created in the same database
transaction. If creation fails, the reservation is rolled back.
"""
import sqlite3, os
from datetime import datetime, timezone
from pathlib import Path
DB_PATH=os.getenv("PHENOVA_USAGE_DB","/tmp/phenova_usage.sqlite3")

def _db():
    Path(DB_PATH).parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DB_PATH,timeout=10,isolation_level=None)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("""CREATE TABLE IF NOT EXISTS daily_usage(
      account_id TEXT NOT NULL, usage_date TEXT NOT NULL,
      basic_edits INTEGER NOT NULL DEFAULT 0,
      pro_edits INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(account_id,usage_date))""")
    c.execute("""CREATE TABLE IF NOT EXISTS edit_jobs(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      edit_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'CREATED')""")
    return c

def create_edit(account_id,edit_type,limit=None,premium=False):
    if edit_type not in {"basic","pro"}:
        raise ValueError("Invalid edit type")
    c=_db()
    try:
        c.execute("BEGIN IMMEDIATE")
        date=datetime.now(timezone.utc).date().isoformat()
        c.execute("INSERT OR IGNORE INTO daily_usage(account_id,usage_date) VALUES(?,?)",
                  (str(account_id),date))
        if not premium:
            col="basic_edits" if edit_type=="basic" else "pro_edits"
            count=c.execute(f"SELECT {col} FROM daily_usage WHERE account_id=? AND usage_date=?",
                            (str(account_id),date)).fetchone()[0]
            if limit is not None and count>=limit:
                c.execute("ROLLBACK")
                return None,"Daily limit reached"
            c.execute(f"UPDATE daily_usage SET {col}={col}+1 WHERE account_id=? AND usage_date=?",
                      (str(account_id),date))
        now=datetime.now(timezone.utc).isoformat()
        cur=c.execute("INSERT INTO edit_jobs(account_id,edit_type,created_at) VALUES(?,?,?)",
                      (str(account_id),edit_type,now))
        edit_id=cur.lastrowid
        c.execute("COMMIT")
        return edit_id,"Edit created"
    except Exception:
        try:c.execute("ROLLBACK")
        except Exception:pass
        raise
    finally:c.close()
