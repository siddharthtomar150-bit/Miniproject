import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List

from database import engine, Base, get_db
import models
import schemas

# Automatically create all SQLite database tables on application initialization
Base.metadata.create_all(bind=engine)

# Initialize FastAPI application with Swagger metadata
app = FastAPI(
    title="Student Performance Tracker API",
    description="A robust RESTful API built with Python, FastAPI, SQLite, and SQLAlchemy to track and evaluate student academic performance.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure Cross-Origin Resource Sharing (CORS)
# Allows the frontend client (Live Server, Localhost, or file origin) to interact with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================================================
# Root / Health Endpoint
# ==========================================================================

@app.get("/api/health", tags=["General"])
def health_check():
    """
    Health check endpoint providing API status and direct link to interactive documentation.
    """
    return {
        "project": "Student Performance Tracker API",
        "status": "online",
        "version": "1.0.0",
        "documentation": "/docs"
    }


# ==========================================================================
# Student CRUD Endpoints
# ==========================================================================

@app.post(
    "/students",
    response_model=schemas.StudentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Students"],
    summary="Register a new student"
)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    """
    Register a new student record:
    - Validates personal and academic details
    - Validates individual subject marks (0-100)
    - Enforces unique roll number constraint
    - Automatically calculates Total Marks (out of 500), Percentage, Grade, and Pass/Fail Status
    """
    # 1. Prevent duplicate roll numbers
    existing_student = db.query(models.Student).filter(
        models.Student.roll_number == student.roll_number
    ).first()

    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Student with roll number '{student.roll_number}' already exists."
        )

    # 2. Compute academic metrics
    total_marks, percentage, grade, status_result = schemas.compute_academic_metrics(
        math=student.mathematics,
        physics=student.physics,
        cs=student.computer_science,
        english=student.english,
        chem=student.chemistry
    )

    # 3. Create SQLAlchemy model instance
    db_student = models.Student(
        name=student.name,
        roll_number=student.roll_number,
        department=student.department,
        semester=student.semester,
        mathematics=student.mathematics,
        physics=student.physics,
        computer_science=student.computer_science,
        english=student.english,
        chemistry=student.chemistry,
        total_marks=total_marks,
        percentage=percentage,
        grade=grade,
        status=status_result
    )

    # 4. Save to database
    db.add(db_student)
    db.commit()
    db.refresh(db_student)

    return db_student


@app.get(
    "/students",
    response_model=List[schemas.StudentResponse],
    tags=["Students"],
    summary="Retrieve all student records"
)
def get_all_students(db: Session = Depends(get_db)):
    """
    Retrieve an ordered list of all student performance records stored in SQLite.
    """
    students = db.query(models.Student).order_by(models.Student.id.desc()).all()
    return students


@app.get(
    "/students/{student_id}",
    response_model=schemas.StudentResponse,
    tags=["Students"],
    summary="Retrieve a single student record by ID"
)
def get_student_by_id(student_id: int, db: Session = Depends(get_db)):
    """
    Retrieve detailed performance information for a specific student using their database ID.
    """
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student record with ID {student_id} not found."
        )
    return student


@app.put(
    "/students/{student_id}",
    response_model=schemas.StudentResponse,
    tags=["Students"],
    summary="Update an existing student record"
)
def update_student(
    student_id: int,
    updated_data: schemas.StudentUpdate,
    db: Session = Depends(get_db)
):
    """
    Update personal details or marks of an existing student:
    - Verifies student existence
    - Ensures the roll number is not taken by another student
    - Automatically re-calculates Total Marks, Percentage, Grade, and Status
    """
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student record with ID {student_id} not found."
        )

    # Check if new roll number belongs to another existing student
    existing_roll = db.query(models.Student).filter(
        models.Student.roll_number == updated_data.roll_number,
        models.Student.id != student_id
    ).first()

    if existing_roll:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Roll number '{updated_data.roll_number}' is already assigned to another student."
        )

    # Re-calculate academic metrics
    total_marks, percentage, grade, status_result = schemas.compute_academic_metrics(
        math=updated_data.mathematics,
        physics=updated_data.physics,
        cs=updated_data.computer_science,
        english=updated_data.english,
        chem=updated_data.chemistry
    )

    # Update model attributes
    db_student.name = updated_data.name
    db_student.roll_number = updated_data.roll_number
    db_student.department = updated_data.department
    db_student.semester = updated_data.semester
    db_student.mathematics = updated_data.mathematics
    db_student.physics = updated_data.physics
    db_student.computer_science = updated_data.computer_science
    db_student.english = updated_data.english
    db_student.chemistry = updated_data.chemistry
    db_student.total_marks = total_marks
    db_student.percentage = percentage
    db_student.grade = grade
    db_student.status = status_result

    db.commit()
    db.refresh(db_student)

    return db_student


@app.delete(
    "/students/{student_id}",
    status_code=status.HTTP_200_OK,
    tags=["Students"],
    summary="Delete a student record"
)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    """
    Permanently delete a student record by ID.
    """
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student record with ID {student_id} not found."
        )

    db.delete(db_student)
    db.commit()

    return {
        "success": True,
        "message": f"Student '{db_student.name}' (Roll No: {db_student.roll_number}) deleted successfully."
    }


# ==========================================================================
# Static Files & Production Frontend Mount
# ==========================================================================

# Resolve path to the frontend directory (supports running from root or backend folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

if not os.path.exists(FRONTEND_DIR):
    FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "frontend"))

if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Student Performance Tracker on port {port}...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

