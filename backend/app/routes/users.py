import uuid

import bcrypt
from fastapi import APIRouter, HTTPException, Request

from ..audit.emitter import emit_user_create, emit_user_delete, emit_user_update
from ..database import (
    create_user,
    delete_user,
    delete_user_sessions,
    get_all_users,
    get_user_by_email,
    get_user_by_id,
    update_user,
)
from ..models import CreateUserRequest, UpdateUserRequest, UserResponse

router = APIRouter()


@router.get("/api/users", response_model=list[UserResponse])
async def list_users():
    users = await get_all_users()
    return [
        UserResponse(
            id=u["id"], email=u["email"], name=u["name"],
            role=u["role"], is_active=u["is_active"],
        )
        for u in users
    ]


@router.post("/api/users", response_model=UserResponse, status_code=201)
async def create_new_user(req: CreateUserRequest, request: Request):
    existing = await get_user_by_email(req.email.lower().strip())
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    password_hash = None
    if req.role == "admin":
        if not req.password:
            raise HTTPException(status_code=400, detail="Password required for admin accounts")
        password_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()

    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    user = await create_user(
        user_id, req.email.lower().strip(), req.name, req.role, password_hash
    )
    await emit_user_create(request.state.user, request, user_id)
    return UserResponse(
        id=user["id"], email=user["email"], name=user["name"],
        role=user["role"], is_active=user["is_active"],
    )


@router.get("/api/users/{user_id}", response_model=UserResponse)
async def get_one_user(user_id: str):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=user["id"], email=user["email"], name=user["name"],
        role=user["role"], is_active=user["is_active"],
    )


@router.patch("/api/users/{user_id}", response_model=UserResponse)
async def update_one_user(user_id: str, req: UpdateUserRequest, request: Request):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    password_hash = None
    new_role = req.role if req.role is not None else user["role"]
    if new_role == "admin" and req.password:
        password_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()

    await update_user(
        user_id,
        name=req.name,
        role=req.role,
        password_hash=password_hash,
        is_active=req.is_active,
    )
    await emit_user_update(request.state.user, request, user_id)
    updated = await get_user_by_id(user_id)
    return UserResponse(
        id=updated["id"], email=updated["email"], name=updated["name"],
        role=updated["role"], is_active=updated["is_active"],
    )


@router.delete("/api/users/{user_id}")
async def delete_one_user(user_id: str, request: Request):
    await delete_user_sessions(user_id)
    deleted = await delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")
    await emit_user_delete(request.state.user, request, user_id)
    return {"deleted": True}
