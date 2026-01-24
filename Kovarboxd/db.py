import os
import time
from sqlalchemy import create_engine, text
from urllib.parse import urlparse


def _mask_dsn(dsn: str) -> str:
	"""Return DSN with password masked for safe printing."""
	parsed = urlparse(dsn)
	if parsed.password:
		masked_netloc = f"{parsed.username}:***@{parsed.hostname}:{parsed.port or 5432}"
	else:
		masked_netloc = f"{parsed.hostname}:{parsed.port or 5432}"
	return f"{parsed.scheme}://{masked_netloc}{parsed.path}"


def _build_dsn() -> str:
	"""Return PostgreSQL DSN, preferring env var or defaulting to docker-compose credentials."""
	# Default matches docker-compose.yml: POSTGRES_USER=kovar, POSTGRES_PASSWORD=kovar_pw, POSTGRES_DB=kovarboxd
	return os.environ.get(
		"POSTGRES_DSN",
		"postgresql+psycopg2://kovar:kovar_pw@localhost:5432/kovarboxd",
	)


def _create_engine_with_retries(dsn: str, max_retries: int = 10, retry_delay: float = 1.0):
	"""Create SQLAlchemy engine with retry logic on connection failures."""
	last_error = None
	
	for attempt in range(max_retries):
		try:
			engine = create_engine(
				dsn,
				pool_pre_ping=True,
				future=True,
				connect_args={"connect_timeout": 5},
			)
			# Test the connection
			with engine.begin() as conn:
				conn.execute(text("SELECT 1"))
			return engine
		except Exception as e:
			last_error = e
			if attempt < max_retries - 1:
				print(f"[db.py] Connection attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {retry_delay}s...")
				time.sleep(retry_delay)
			else:
				print(f"[db.py] All {max_retries} connection attempts failed.")
	
	raise RuntimeError(
		f"Failed to connect to PostgreSQL after {max_retries} attempts. "
		f"Last error: {last_error}"
	) from last_error


# Build DSN and create engine with retries
_dsn = _build_dsn()
engine = _create_engine_with_retries(_dsn)

print(f"[db.py] Connected to PostgreSQL at DSN: {_mask_dsn(_dsn)}")


def get_connection():
	"""Provide a DBAPI connection for legacy code paths."""
	return engine.raw_connection()
