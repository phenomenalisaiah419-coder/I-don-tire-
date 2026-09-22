"""Server-authoritative PHENOVA owner entitlement."""
from .owner_access import verify_owner_session

def get_entitlements(owner_session_token, account_id):
    if not verify_owner_session(owner_session_token, account_id):
        return {"authenticated":False,"entitlements":[]}
    return {"authenticated":True,"entitlements":["PHENOVA_PREMIUM","OWNER_ACCESS"]}
