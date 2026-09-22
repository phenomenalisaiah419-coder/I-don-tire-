"""Atomic per-account daily usage reservation."""
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
    return c

def today(): return datetime.now(timezone.utc).date().isoformat()

def get_usage(account_id,date=None):
    date=date or today(); c=_db()
    try:
        row=c.execute("SELECT basic_edits,pro_edits FROM daily_usage WHERE account_id=? AND usage_date=?",(str(account_id),date)).fetchone()
        return {"date":date,"basic_edits":row[0] if row else 0,"pro_edits":row[1] if row else 0}
    finally:c.close()

def reserve_edit(account_id,edit_type,limit):
    if edit_type not in {"basic","pro"}: raise ValueError("Invalid edit type")
    col="basic_edits" if edit_type=="basic" else "pro_edits"; date=today()
    c=_db()
    try:
        c.execute("BEGIN IMMEDIATE")
        c.execute("INSERT OR IGNORE INTO daily_usage(account_id,usage_date) VALUES(?,?)",(str(account_id),date))
        row=c.execute(f"SELECT {col} FROM daily_usage WHERE account_id=? AND usage_date=?",(str(account_id),date)).fetchone()
        if row[0]>=limit:
            c.execute("ROLLBACK"); return False
        c.execute(f"UPDATE daily_usage SET {col}={col}+1 WHERE account_id=? AND usage_date=?",(str(account_id),date))
        c.execute("COMMIT"); return True
    except Exception:
        try:c.execute("ROLLBACK")
        except Exception:pass
        raise
    finally:c.close()
