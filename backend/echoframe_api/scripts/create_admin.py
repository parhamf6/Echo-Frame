import sys
from pathlib import Path

# Add parent directory to Python path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy.orm import Session
from app.core.database import sync_engine
from app.core.security import get_password_hash
from app.models.admin import Admin
import argparse


def create_admin(username: str, password: str):
    """Create a new admin user"""
    from sqlalchemy.orm import sessionmaker
    
    SessionLocal = sessionmaker(bind=sync_engine)
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        existing_admin = db.query(Admin).filter(Admin.username == username).first()
        if existing_admin:
            print(f"❌ Error: Admin with username '{username}' already exists!")
            return False
        
        # Create new admin
        hashed_password = get_password_hash(password)
        new_admin = Admin(
            username=username,
            hashed_password=hashed_password
        )
        
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        
        print(f"✅ Admin '{username}' created successfully!")
        print(f"Admin ID: {new_admin.id}")
        print(f"Created at: {new_admin.created_at}")
        return True
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating admin: {e}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create admin user for EchoFrame")
    parser.add_argument("--username", required=True, help="Admin username")
    parser.add_argument("--password", required=True, help="Admin password")
    
    args = parser.parse_args()
    
    create_admin(args.username, args.password)