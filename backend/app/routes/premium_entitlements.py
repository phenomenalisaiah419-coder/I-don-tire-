from fastapi import APIRouter,Depends,Header
from ..models import User
from ..security import get_current_user
from ..services.owner_entitlement import get_entitlements
from ..services.premium_entitlements import premium_summary

router=APIRouter()

@router.get("/features")
def features(user:User=Depends(get_current_user),
             authorization:str|None=Header(default=None)):
    token=""
    if authorization and authorization.lower().startswith("bearer "):
        token=authorization[7:].strip()
    data=get_entitlements(token,str(user.id))
    entitlements=set(data["entitlements"])
    return {"authenticated":data["authenticated"],
            **premium_summary(entitlements)}
