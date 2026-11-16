# Student Performance Tracker (College Mini Project)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/siddharthtomar150-bit/Miniproject)

A modern, full-stack web application designed for academic institutions to register students, record multi-subject marks, automatically compute totals, percentages, letter grades, and pass/fail statuses, and monitor real-time class performance metrics.

---

## 🚀 Tech Stack

* **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+ with Fetch API)
* **Backend**: Python 3.14+, FastAPI (REST API framework)
* **ORM & Database**: SQLAlchemy ORM with SQLite (`students.db`)
* **Data Validation**: Pydantic v2
* **API Server**: Uvicorn ASGI Server

---

## 📁 Project Structure

```text
student-performance-tracker/
├── frontend/
│   ├── index.html        # Semantic dashboard markup & UI structure
│   ├── style.css         # Modern blue & white responsive theme
│   └── script.js         # Fetch API client, state, validation, DOM controller
├── backend/
│   ├── main.py           # FastAPI application, endpoints & CORS config
│   ├── database.py       # SQLite connection & SQLAlchemy session factory
│   ├── models.py         # SQLAlchemy ORM model (students table)
│   ├── schemas.py        # Pydantic schemas & grading business logic
│   ├── requirements.txt  # Python backend dependencies
│   └── students.db       # Persistent SQLite database file
└── README.md             # Project documentation
```

---

## ⚙️ Setup & Running Instructions

### 1. Start the FastAPI Backend

1. Open your terminal in the `backend/` directory:
   ```powershell
   cd c:\student-perfomance-tracker\backend
   ```
2. (Optional) Activate your virtual environment if one is created:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
3. Start the Uvicorn ASGI server:
   ```powershell
   uvicorn main:app --reload --port 8000
   ```
   *(Note: If port 8000 is in use on your Windows PC, use `--port 8001` instead: `uvicorn main:app --reload --port 8001`. The frontend auto-detects both ports!)*
   * The API server will run at: `http://127.0.0.1:8000` (or `http://127.0.0.1:8001`)
   * Interactive Swagger UI documentation: `http://127.0.0.1:8000/docs` (or `:8001/docs`)

---

### 2. Launch the Frontend Dashboard

You can run the frontend using either VS Code Live Server or Python's built-in HTTP server:

#### **Method A: VS Code Live Server (Recommended)**
1. Open the project in VS Code.
2. Right-click on `frontend/index.html` and select **"Open with Live Server"**.
3. The dashboard will launch at `http://127.0.0.1:5500/frontend/index.html`.

#### **Method B: Python Built-in HTTP Server**
Run in a new terminal:
```powershell
python -m http.server 5500 --directory c:\student-perfomance-tracker\frontend
```
Then visit: `http://localhost:5500`

---

## 🎯 Academic Grading & Calculation Rules

* **Total Marks**: Out of 500 ($\text{Math} + \text{Physics} + \text{CS} + \text{English} + \text{Chemistry}$).
* **Percentage**: $(\text{Total Marks} / 500) \times 100$.
* **Grade Scale**:
  * **90% – 100%**: Grade `A`
  * **75% – 89.9%**: Grade `B`
  * **60% – 74.9%**: Grade `C`
  * **40% – 59.9%**: Grade `D`
  * **Below 40%**: Grade `F`
* **Pass / Fail Condition**:
  * A student is marked **Passed** only when **every single subject has at least 40 marks**.
  * If any subject is $< 40$, the student is automatically marked **Failed**.
  * If all subjects $\ge 40$ and percentage $\ge 75\%$, the student earns the **Distinction** badge.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | API status & welcome message |
| `POST` | `/students` | Register a new student & calculate metrics |
| `GET` | `/students` | Retrieve all student records from SQLite |
| `GET` | `/students/{id}` | Retrieve a single student by database ID |
| `PUT` | `/students/{id}` | Update student details/marks & recalculate |
| `DELETE` | `/students/{id}` | Delete a student record from SQLite |

---

## ☁️ Deployment (Render.com)

This project is fully configured for zero-configuration 1-click deployment on [Render](https://render.com).

### Deployment Configuration
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python run.py`
- **Environment**: Python 3 (Free Tier supported)
- **Unified Architecture**: FastAPI serves both the REST API and the frontend dashboard from a single URL with zero CORS setup.

---

## 🔒 Security & Data Integrity

1. **Unique Roll Numbers**: Enforces institutional roll number uniqueness both client-side and at the database level.
2. **Input Validation**: Pydantic verifies subject marks are strictly between `0.0` and `100.0`.
3. **CORS Configured**: Permits cross-origin requests from `http://127.0.0.1:5500` and `http://localhost:5500`.
4. **Persistent Storage**: SQLite acts as the single source of truth; all additions, edits, and deletions persist across page refreshes.
