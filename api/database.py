import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Optional
import logging
import os

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, db_path: str = "research_sessions.db"):
        self.db_path = db_path
        self._ensure_db_exists()
        self._init_db()

    def _ensure_db_exists(self):
        """Ensure the database file exists"""
        if not os.path.exists(self.db_path):
            try:
                # Create the database file
                with open(self.db_path, 'w') as f:
                    pass  # Just create an empty file
                logger.info(f"Created new database file at {self.db_path}")
            except Exception as e:
                logger.error(f"Error creating database file: {str(e)}")
                raise

    def _init_db(self):
        """Initialize database with required tables"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create research sessions table with NOT NULL constraints
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS research_sessions (
                    session_id TEXT PRIMARY KEY,
                    query TEXT NOT NULL DEFAULT '',
                    mode TEXT NOT NULL DEFAULT 'research',
                    status TEXT NOT NULL DEFAULT 'pending',
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    result TEXT,
                    settings TEXT,
                    research_details TEXT
                )
                """)
                
                conn.commit()
                logger.info("Database schema initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing database: {str(e)}")
            raise

    def save_session(self, session_id: str, data: Dict) -> None:
        """Save or update a research session"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Convert dictionaries to JSON strings
                settings = json.dumps(data.get('settings', {}))
                research_details = json.dumps(data.get('research_details', {}))
                
                # Ensure query has a default value
                query = data.get('query', '')
                mode = data.get('mode', 'research')
                
                cursor.execute("""
                INSERT OR REPLACE INTO research_sessions (
                    session_id, query, mode, status, start_time, end_time, 
                    result, settings, research_details
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    session_id,
                    query,
                    mode,
                    data.get('status', 'pending'),
                    data.get('created_at', datetime.now().isoformat()),
                    data.get('end_time'),
                    data.get('result'),
                    settings,
                    research_details
                ))
                
                conn.commit()
                logger.debug(f"Saved session {session_id} successfully")
        except Exception as e:
            logger.error(f"Error saving session: {str(e)}")
            raise

    def get_session(self, session_id: str) -> Optional[Dict]:
        """Retrieve a specific research session"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                SELECT * FROM research_sessions WHERE session_id = ?
                """, (session_id,))
                
                row = cursor.fetchone()
                if row:
                    return self._row_to_dict(cursor.description, row)
                return None
        except Exception as e:
            logger.error(f"Error retrieving session: {str(e)}")
            return None

    def get_all_sessions(self) -> List[Dict]:
        """Retrieve all research sessions"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                SELECT * FROM research_sessions 
                ORDER BY start_time DESC
                """)
                
                rows = cursor.fetchall()
                return [self._row_to_dict(cursor.description, row) for row in rows]
        except Exception as e:
            logger.error(f"Error retrieving sessions: {str(e)}")
            return []

    def delete_session(self, session_id: str) -> bool:
        """Delete a research session"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                DELETE FROM research_sessions WHERE session_id = ?
                """, (session_id,))
                
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Error deleting session: {str(e)}")
            return False

    def update_session_status(self, session_id: str, status: str, result: Optional[str] = None) -> None:
        """Update session status and optionally the result"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                if result is not None:
                    cursor.execute("""
                    UPDATE research_sessions 
                    SET status = ?, result = ?, end_time = ? 
                    WHERE session_id = ?
                    """, (status, result, datetime.now().isoformat(), session_id))
                else:
                    cursor.execute("""
                    UPDATE research_sessions 
                    SET status = ? 
                    WHERE session_id = ?
                    """, (status, session_id))
                
                conn.commit()
                logger.debug(f"Updated session {session_id} status to {status}")
        except Exception as e:
            logger.error(f"Error updating session status: {str(e)}")
            raise

    def _row_to_dict(self, description: List, row: tuple) -> Dict:
        """Convert a database row to a dictionary"""
        result = {}
        for i, col in enumerate(description):
            value = row[i]
            # Parse JSON fields
            if col[0] in ['settings', 'research_details'] and value:
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    value = {}
            result[col[0]] = value
        return result
