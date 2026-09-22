from fastapi import APIRouter,Depends,Header
from ..models import User
from ..security import get_current_user
from ..services.owner_entitlement import get_entitlements

router=APIRouter()

@router.get("")
def entitlements(user:User=Depends(get_current_user),
                 authorization:str|None=Header(default=None)):
    token=""
    if authorization and authorization.lower().startswith("bearer "):
        token=authorization[7:].strip()
    return get_entitlements(token,str(user.id))
