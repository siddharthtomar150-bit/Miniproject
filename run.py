"""
Student Performance Tracker - Application Entry Point
Starts the unified FastAPI backend which serves both the REST API and the frontend dashboard.
"""

import os
import sys
import socket
# pyrefly: ignore[missing-import]
import uvicorn

# Ensure the backend directory is in the Python module search path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def get_free_port(preferred_port=8000):
    """
    Checks if the preferred port is free to bind.
    If occupied, automatically falls back to alternative ports (8001, 8080).
    """
    ports_to_try = [preferred_port, 8001, 8080, 5000]
    for p in ports_to_try:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("0.0.0.0", p))
                return p
        except OSError:
            continue
    return preferred_port


if __name__ == "__main__":
    # Support cloud deployment platforms (Render, Railway, etc.) via PORT env var
    env_port = os.environ.get("PORT")
    if env_port:
        port = int(env_port)
    else:
        port = get_free_port(8000)

    host = os.environ.get("HOST", "0.0.0.0")

    print("=" * 65)
    print("  Student Performance Tracker - Server Starting")
    print(f"  Access Dashboard: http://localhost:{port}")
    print(f"  Swagger API Docs: http://localhost:{port}/docs")
    print("=" * 65)

    uvicorn.run("backend.main:app", host=host, port=port, reload=False)
