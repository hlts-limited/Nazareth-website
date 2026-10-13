import os
from dotenv import load_dotenv

# Load environmental configs
load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-nazareth-dev-only")
    DEBUG = os.getenv("DEBUG", "True").lower() == "true"
    PORT = int(os.getenv("PORT", 5000))
    
    # Upload limits (4MB max per file as requested)
    MAX_CONTENT_LENGTH = 4 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png'}
    
    # Sessions security settings
    SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
