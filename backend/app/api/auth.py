from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.database import get_session
from app.models.user import User
from app.utils.security import hash_password, verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    role: Optional[str] = "caregiver"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> User:
    sub = decode_access_token(token)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = session.exec(select(User).where(User.email == sub)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == req.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=req.name,
        email=req.email,
        phone=req.phone,
        password_hash=hash_password(req.password),
        role=req.role or "caregiver"
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
    }

@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    token = create_access_token(user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role
    }
