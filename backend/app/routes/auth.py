from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, Subscription
from ..schemas import RegisterRequest, LoginRequest
from ..security import hash_password, verify_password, create_token

router = APIRouter()

@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, "Account already exists")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user); db.flush()
    db.add(Subscription(user_id=user.id, plan="FREE"))
    db.commit()
    return {"access_token": create_token(user.id), "token_type": "bearer"}

@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": create_token(user.id), "token_type": "bearer"}
