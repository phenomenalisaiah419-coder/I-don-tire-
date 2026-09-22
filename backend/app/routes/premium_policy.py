from fastapi import APIRouter,Depends,Header,HTTPException
from ..models import User
from ..security import get_current_user
from ..services.owner_entitlement import get_entitlements
from ..services.premium_policy import policy,create_admitted_edit

router=APIRouter()
def ents(user,authorization):
    token=authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else ""
    return set(get_entitlements(token,str(user.id))["entitlements"])

def signup(user):
    return getattr(user,"created_at",None) or getattr(user,"signup_at",None)

@router.get("/policy")
def get_policy(user:User=Depends(get_current_user),authorization:str|None=Header(default=None)):
    return policy(ents(user,authorization),signup(user))

@router.post("/create-edit")
def create(edit_type:str,user:User=Depends(get_current_user),authorization:str|None=Header(default=None)):
    e=ents(user,authorization)
    edit_id,msg=create_admitted_edit(e,str(user.id),edit_type,signup(user))
    if edit_id is None: raise HTTPException(403,msg)
    return {"created":True,"edit_id":edit_id,"message":msg}
