import re
import sqlite3
from contextlib import contextmanager

import config as cfg

IS_POSTGRES = cfg.DATABASE_URL.startswith(("postgresql://", "postgres://"))
DATABASE_KIND = "postgresql" if IS_POSTGRES else "sqlite"


@contextmanager
def connection():
    if IS_POSTGRES:
        import psycopg  # only needed for PostgreSQL
        conn = psycopg.connect(cfg.DATABASE_URL)
    else:
        conn = sqlite3.connect(cfg.DATABASE_URL.replace("sqlite:///", "", 1))
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _native(sql):
    """Convert :name parameters to psycopg's %(name)s style."""
    if IS_POSTGRES:
        return re.sub(r"(?<!:):([a-z_][a-z0-9_]*)", r"%(\1)s", sql)
    return sql


def fetch(conn, sql, params=None):
    cursor = conn.cursor()
    cursor.execute(_native(sql), params or {})
    names = [column[0] for column in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def execute(conn, sql, params=None):
    conn.cursor().execute(_native(sql), params or {})


def insert_rows(conn, table, rows):
    if not rows:
        return
    columns = list(rows[0])
    sql = (f"INSERT INTO {table} ({', '.join(columns)}) "
           f"VALUES ({', '.join(':' + c for c in columns)})")
    conn.cursor().executemany(_native(sql), rows)


def run_script(conn, script):
    without_comments = re.sub(r"--[^\n]*", "", script)
    cursor = conn.cursor()
    for statement in without_comments.split(";"):
        if statement.strip():
            cursor.execute(statement)


def query(sql, params=None):
    with connection() as conn:
        return fetch(conn, sql, params)


def query_one(sql, params=None):
    return query(sql, params)[0]


def stream(sql, params=None, batch=5000):
    """Yield rows as tuples, one batch at a time, for large downloads."""
    with connection() as conn:
        cursor = conn.cursor()
        cursor.execute(_native(sql), params or {})
        while True:
            rows = cursor.fetchmany(batch)
            if not rows:
                break
            yield from rows
