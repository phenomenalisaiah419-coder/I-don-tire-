from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from ..security import get_current_user
from ..models import User
from ..services.owner_access import setup_owner, authenticate, status, create_owner_session

router=APIRouter()

class Setup(BaseModel):
    email:str
    password:str
    password_confirmation:str

class Auth(BaseModel):
    email:str
    password:str

def current_account(user:User=Depends(get_current_user)):
    return user

@router.get("/status")
def owner_status(user:User=Depends(current_account)):
    return status(str(user.id))

@router.post("/setup")
def owner_setup(body:Setup,user:User=Depends(current_account)):
    ok,msg=setup_owner(str(user.id),body.email,body.password,body.password_confirmation)
    if not ok:
        raise HTTPException(409 if "already" in msg else 400,msg)
    return {"configured":True,"message":msg}

@router.post("/authenticate")
def owner_auth(body:Auth,user:User=Depends(current_account)):
    ok,msg=authenticate(str(user.id),body.email,body.password)
    result={"authenticated":ok,"message":msg,"owner_access":"PHENOVA_PREMIUM" if ok else None}
    if ok:
        result["owner_session_token"]=create_owner_session(str(user.id))
        result["owner_session_expires_in"]=3600
    return result
