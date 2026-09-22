import os, tempfile
os.environ["PHENOVA_OWNER_DB"]=os.path.join(tempfile.gettempdir(),f"phenova_owner_test_{os.getpid()}.sqlite3")
try: os.remove(os.environ["PHENOVA_OWNER_DB"])
except FileNotFoundError: pass
from backend.app.services.owner_access import setup_owner,verify_owner,owner_status

def test_one_time_setup():
    ok,msg=setup_owner("owner@example.com","secret","secret")
    assert ok and owner_status()["configured"]
    ok,msg=setup_owner("other@example.com","x","x")
    assert not ok
    assert verify_owner("owner@example.com","secret")[0]
    assert not verify_owner("owner@example.com","wrong")[0]

def test_confirmation():
    # already configured in this process, so setup remains blocked
    ok,msg=setup_owner("x@example.com","a","b")
    assert not ok
