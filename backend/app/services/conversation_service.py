import sqlite3
import os
from datetime import datetime
from typing import List, Dict, Optional, Any
from app.services.db_service import DB_PATH

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_conversations_table():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id TEXT NOT NULL,
            lead_key TEXT,
            date TEXT NOT NULL,
            conversation_type TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            author TEXT
        )
    """)
    # Ensure author column exists if created previously
    cursor.execute("PRAGMA table_info(conversations)")
    columns = [col[1] for col in cursor.fetchall()]
    if "author" not in columns:
        try:
            cursor.execute("ALTER TABLE conversations ADD COLUMN author TEXT")
        except Exception:
            pass
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_date ON conversations(date)")
    conn.commit()
    conn.close()

# Auto-initialize table on module import
init_conversations_table()

def add_conversation(
    lead_id: str,
    date: str,
    conversation_type: str,
    message: str,
    lead_key: Optional[str] = None,
    author: Optional[str] = None
) -> Dict[str, Any]:
    init_conversations_table()
    now_str = datetime.utcnow().isoformat()
    lead_id_clean = str(lead_id).strip()
    date_clean = str(date).strip()
    type_clean = str(conversation_type).strip()
    msg_clean = str(message).strip()
    key_clean = str(lead_key).strip() if lead_key else ""
    author_clean = str(author).strip() if author else ""

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO conversations (lead_id, lead_key, date, conversation_type, message, created_at, author)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (lead_id_clean, key_clean, date_clean, type_clean, msg_clean, now_str, author_clean))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return {
        "id": new_id,
        "lead_id": lead_id_clean,
        "lead_key": key_clean,
        "date": date_clean,
        "conversation_type": type_clean,
        "message": msg_clean,
        "created_at": now_str,
        "author": author_clean
    }

def get_conversations(
    lead_id: Optional[str] = None,
    date: Optional[str] = None
) -> List[Dict[str, Any]]:
    init_conversations_table()
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT id, lead_id, lead_key, date, conversation_type, message, created_at, author FROM conversations"
    params = []
    conditions = []

    if lead_id:
        conditions.append("(lead_id = ? OR lead_key = ?)")
        params.extend([lead_id.strip(), lead_id.strip()])

    if date:
        conditions.append("date = ?")
        params.append(date.strip())

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    # Order newest first
    query += " ORDER BY date DESC, id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "lead_id": r["lead_id"],
            "lead_key": r["lead_key"],
            "date": r["date"],
            "conversation_type": r["conversation_type"],
            "message": r["message"],
            "created_at": r["created_at"],
            "author": r["author"] if "author" in r.keys() and r["author"] else ""
        })
    return results

def delete_conversation(conversation_id: int) -> bool:
    init_conversations_table()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0
