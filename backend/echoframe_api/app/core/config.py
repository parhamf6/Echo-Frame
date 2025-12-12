from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """
    Application Settings
    
    🔒 PRODUCTION CHECKLIST:
    - Set DEBUG=False in .env
    - Set ENVIRONMENT=production in .env
    - Use strong random SECRET_KEY (32+ chars)
    - Configure ALLOWED_ORIGINS with actual domains
    - Adjust token expiry times
    - Enable validation checks (uncomment validate_secrets call at bottom)
    """
    
    # Database URLs
    DATABASE_URL: str
    DATABASE_URL_SYNC: str
    
    # Redis URL
    REDIS_URL: str
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # 🔒 PRODUCTION: Change to 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Application
    APP_NAME: str = "EchoFrame"
    DEBUG: bool = True  # 🔒 PRODUCTION: Must be False
    ENVIRONMENT: str = "development"  # 🔒 PRODUCTION: Change to 'production'
    
    # CORS - Cross-Origin Resource Sharing
    # 🔒 PRODUCTION: Replace with actual frontend domain
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",  # Next.js dev server
        "http://localhost:8000",  # FastAPI dev server
    ]
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60  # 🔒 PRODUCTION: Adjust based on traffic
    # Guest rate limiting (defaults used for anonymous guest actions)
    GUEST_RATE_LIMIT_PER_HOUR: int = 3
    GUEST_RATE_PERIOD_SECONDS: int = 3600
    RATE_LIMIT_KEY_PREFIX: str = "rl"
    
    # File Upload Settings
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024 * 1024  # 10GB
    ALLOWED_VIDEO_EXTENSIONS: List[str] = [".m3u8", ".ts", ".mp4", ".mkv"]
    ALLOWED_SUBTITLE_EXTENSIONS: List[str] = [".vtt", ".srt", ".ass"]
    
    # Storage paths
    STORAGE_PATH: str = "storage"
    VIDEO_STORAGE_PATH: str = "storage/videos"
    SUBTITLE_STORAGE_PATH: str = "storage/subtitles"

    # LiveKit
    LIVEKIT_HOST: str = "http://localhost:7880"
    LIVEKIT_API_KEY: str = "devkey123456789abcdef"
    LIVEKIT_API_SECRET: str = "devsecret123456789abcdefghijklmnopqrstuvwxyz0123456789abcdef"
    LIVEKIT_WEBHOOK_SECRET: str = "webhook_secret_change_this"

    # Cookie settings
    REFRESH_COOKIE_NAME: str = "refresh_token"
    REFRESH_COOKIE_SAMESITE: str = "lax"  # one of 'lax', 'strict', 'none'
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    # Helper properties
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT == "development"
    
    def validate_secrets(self):
        """
        Validate security settings for production
        
        🔒 PRODUCTION: Uncomment the settings.validate_secrets() call
        at the bottom of this file to enable validation
        """
        if self.is_production:
            errors = []
            
            # Check SECRET_KEY length
            if len(self.SECRET_KEY) < 32:
                errors.append("SECRET_KEY must be at least 32 characters in production")
            
            # Check for default values
            if "change_this" in self.SECRET_KEY.lower():
                errors.append("SECRET_KEY must be changed from default value")
            
            if "password" in self.DATABASE_URL.lower() and "change" in self.DATABASE_URL.lower():
                errors.append("Database password must be changed from default")
            
            # Check DEBUG is disabled
            if self.DEBUG:
                errors.append("DEBUG must be False in production (security risk!)")
            
            # Check CORS is configured
            if "localhost" in str(self.ALLOWED_ORIGINS):
                errors.append("ALLOWED_ORIGINS should not include localhost in production")
            
            # Check token expiry
            if self.ACCESS_TOKEN_EXPIRE_MINUTES > 15:
                errors.append("ACCESS_TOKEN_EXPIRE_MINUTES should be 15 or less in production")
            
            if errors:
                raise ValueError(f"Production configuration errors:\n" + "\n".join(f"- {e}" for e in errors))


# Initialize settings
settings = Settings()

# 🔒 PRODUCTION: Uncomment this line to enable validation
# if settings.is_production:
#     settings.validate_secrets()
