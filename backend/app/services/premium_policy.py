"""PHENOVA plan policy with transaction-safe edit creation."""
from datetime import datetime,timezone
from .edit_creation import create_edit

def days_since_signup(signup_at):
    if not signup_at:return 0
    if isinstance(signup_at,str):
        signup_at=datetime.fromisoformat(signup_at.replace("Z","+00:00"))
    if signup_at.tzinfo is None: signup_at=signup_at.replace(tzinfo=timezone.utc)
    return max(0,(datetime.now(timezone.utc)-signup_at).days)

def premium(e): return "PHENOVA_PREMIUM" in e

def policy(e,signup_at=None):
    age=days_since_signup(signup_at)
    if premium(e):
        return {"plan":"premium","quality":"1080p","max_clips":15,
                "max_clip_minutes":5,"max_single_video_minutes":120,
                "corrections":"unlimited","days_since_signup":age}
    return {"plan":"free","first_month":age<30,
            "daily_pro_edits":1 if age<30 else 0,
            "daily_basic_edits":2,"pro_1080p_days":3,
            "basic_quality":"720p","corrections_per_edit":5,
            "basic_max_clips":5,"basic_max_clip_minutes":5,
            "basic_max_single_video_minutes":30,"days_since_signup":age}

def create_admitted_edit(e,account_id,edit_type,signup_at=None):
    if premium(e): return create_edit(account_id,edit_type,premium=True)
    age=days_since_signup(signup_at)
    if edit_type=="pro":
        if age>=30:return None,"Pro edit period has ended"
        return create_edit(account_id,"pro",limit=1)
    if edit_type=="basic":
        return create_edit(account_id,"basic",limit=2)
    return None,"Unsupported edit type"
