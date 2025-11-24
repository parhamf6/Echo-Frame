from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

"""
Security Utilities

🔒 PRODUCTION BEST PRACTICES:
1. Passwords are hashed with bcrypt (industry standard)
2. JWT tokens expire (short lifespan reduces risk)
3. Refresh tokens allow long sessions without storing passwords
4. Token validation is strict
"""

# Password hashing context
# 🔒 PRODUCTION: bcrypt is secure, but slow (this is good for passwords!)
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # 🔒 PRODUCTION: Higher rounds = more secure but slower (12 is good balance)
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash
    
    Args:
        plain_password: User-provided password
        hashed_password: Stored hash from database
    
    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password for storage
    
    🔒 PRODUCTION: Never store plain passwords!
    Always hash before storing in database
    
    Args:
        password: Plain text password
    
    Returns:
        Hashed password string
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token
    
    🔒 PRODUCTION: Short lifespan (15 min) reduces risk if token is stolen
    
    Args:
        data: Dictionary of claims to encode (e.g., {"sub": user_id})
        expires_delta: Optional custom expiration time
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),  # Issued at
        "type": "access"
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Create JWT refresh token
    
    🔒 PRODUCTION: Longer lifespan (7 days) for better UX
    Used to get new access tokens without re-login
    
    Args:
        data: Dictionary of claims to encode
    
    Returns:
        Encoded JWT refresh token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and verify JWT token
    
    🔒 PRODUCTION: Validates signature, expiration, and claims
    
    Args:
        token: JWT token string
    
    Returns:
        Token payload if valid, None if invalid
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError as e:
        # 🔒 PRODUCTION: Log token errors for security monitoring
        if settings.is_production:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Invalid token: {str(e)}")
        return None


def verify_token_type(token: str, expected_type: str) -> bool:
    """
    Verify token is of expected type (access or refresh)
    
    🔒 PRODUCTION: Prevents using refresh tokens as access tokens
    
    Args:
        token: JWT token string
        expected_type: "access" or "refresh"
    
    Returns:
        True if token type matches, False otherwise
    """
    payload = decode_token(token)
    if not payload:
        return False
    
    return payload.get("type") == expected_type
