"""Owner Access bound to the authenticated PHENOVA account."""
import os,time,hashlib,hmac,sqlite3
import jwt
from datetime import datetime,timedelta,timezone
from ..config import settings
from pathlib import Path
from threading import Lock
DB_PATH=os.getenv("PHENOVA_OWNER_DB","/tmp/phenova_owner_access.sqlite3")

def _db_path(): return os.getenv("PHENOVA_OWNER_DB", DB_PATH)
MAX_FAILURES=3; LOCK_SECONDS=7*24*60*60; _lock=Lock()
def _db():
    Path(DB_PATH).parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(_db_path())
    c.execute("CREATE TABLE IF NOT EXISTS owner_credentials (id INTEGER PRIMARY KEY CHECK(id=1), account_id TEXT NOT NULL, email TEXT NOT NULL, token_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at REAL NOT NULL)")
    c.execute("CREATE TABLE IF NOT EXISTS owner_lock (id INTEGER PRIMARY KEY CHECK(id=1), failures INTEGER NOT NULL DEFAULT 0, locked_until REAL NOT NULL DEFAULT 0)")
    c.execute("INSERT OR IGNORE INTO owner_lock(id) VALUES(1)"); c.commit(); return c
def _hash(v,s): return hashlib.pbkdf2_hmac("sha256",v.encode(),s.encode(),150000).hex()
def setup_owner(account_id,email=None,password=None,confirmation=None):
    # Legacy form: setup_owner(email,password,confirmation)
    if confirmation is None and isinstance(account_id,str) and "@" in account_id and isinstance(password,str):
        account_id,email,password,confirmation="legacy-owner",account_id,email,password
    if not account_id:return False,"Authentication required"
    if not email or not str(email).strip() or not password:return False,"Email and password are required"
    if confirmation is not None and password!=confirmation:return False,"Password confirmation does not match"
    with _lock:
        c=_db()
        try:
            if c.execute("SELECT 1 FROM owner_credentials WHERE id=1").fetchone(): return False,"Owner Access is already configured"
            salt=os.urandom(16).hex()
            c.execute("INSERT INTO owner_credentials VALUES(1,?,?,?,?,?)",(account_id,email.strip().lower(),_hash(password,salt),salt,time.time())); c.commit()
            return True,"Owner Access configured"
        finally:c.close()
def authenticate(account_id,email,password):
    if not account_id:return False,"Authentication required"
    now=time.time()
    with _lock:
        c=_db()
        try:
            failures,locked=c.execute("SELECT failures,locked_until FROM owner_lock WHERE id=1").fetchone()
            if now<locked:return False,"Owner Access is temporarily locked"
            row=c.execute("SELECT account_id,email,token_hash,salt FROM owner_credentials WHERE id=1").fetchone()
            if not row:return False,"Owner Access has not been configured"
            good=hmac.compare_digest(account_id,row[0]) and hmac.compare_digest(email.strip().lower(),row[1]) and hmac.compare_digest(_hash(password,row[3]),row[2])
            if good:
                c.execute("UPDATE owner_lock SET failures=0,locked_until=0 WHERE id=1"); c.commit(); return True,"Owner authenticated"
            failures+=1; until=now+LOCK_SECONDS if failures>=MAX_FAILURES else 0
            c.execute("UPDATE owner_lock SET failures=?,locked_until=?",(0 if until else failures,until)); c.commit()
            return False,"Owner credentials are invalid"
        finally:c.close()
def create_owner_session(account_id):
    return jwt.encode(
        {"sub": str(account_id), "owner": True,
         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        settings.jwt_secret, algorithm="HS256"
    )

def verify_owner_session(token, account_id):
    try:
        payload=jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload.get("owner") is True and str(payload.get("sub")) == str(account_id)
    except jwt.InvalidTokenError:
        return False

def status(account_id):
    c=_db()
    try:
        row=c.execute("SELECT account_id FROM owner_credentials WHERE id=1").fetchone()
        return {"configured":bool(row),"bound_to_current_account":bool(row and account_id and row[0]==account_id)}
    finally:c.close()


def verify_owner(*args):
    """Compatibility helper for both legacy and account-bound callers."""
    if len(args)==2:
        email,password=args
        return authenticate("legacy-owner",email,password)
    if len(args)==3:
        return authenticate(args[0],args[1],args[2])
    raise TypeError("verify_owner expects email,password or account_id,email,password")


def owner_status(account_id=None):
    return status(account_id or 'legacy-owner')
