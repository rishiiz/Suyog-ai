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
    name: Optional[str] = None
    full_name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    phone_number: Optional[str] = None
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
    user_name = req.name or req.full_name
    if not user_name:
        raise HTTPException(status_code=422, detail="Name is required")
    user_phone = req.phone or req.phone_number or ""

    existing = session.exec(select(User).where(User.email == req.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=user_name,
        email=req.email,
        phone=user_phone,
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
def get_me(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    from app.models.user import ElderCaregiver
    from app.models.elder import Elder
    links = session.exec(select(ElderCaregiver).where(ElderCaregiver.user_id == current_user.id)).all()
    elders = []
    for link in links:
        elder = session.get(Elder, link.elder_id)
        if elder:
            elders.append({
                "id": elder.id,
                "name": elder.name,
                "age": elder.age,
                "phone": elder.phone,
                "relationship": link.relationship,
                "priority": link.priority
            })
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "elders": elders,
        "is_demo": current_user.email == "rohit.kulkarni@example.com"
    }

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

@router.put("/me")
def update_profile(req: UpdateProfileRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if req.name is not None and req.name.strip():
        current_user.name = req.name.strip()
    if req.phone is not None:
        current_user.phone = req.phone.strip()
    if req.email is not None and req.email != current_user.email:
        existing = session.exec(select(User).where(User.email == req.email)).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="Email is already registered by another account.")
        current_user.email = req.email

    if req.new_password:
        if not req.current_password or not verify_password(req.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
        if len(req.new_password) < 8:
            raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
        current_user.password_hash = hash_password(req.new_password)

    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    token = create_access_token(current_user.email)
    return {
        "status": "success",
        "access_token": token,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "phone": current_user.phone,
            "role": current_user.role,
        }
    }
