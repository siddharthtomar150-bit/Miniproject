from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class StudentBase(BaseModel):
    """
    Base Pydantic model defining shared fields and input validation rules.
    Enforces required strings and ensures subject marks are strictly between 0 and 100.
    """
    name: str = Field(..., min_length=2, max_length=100, description="Full name of the student", examples=["Rahul Sharma"])
    roll_number: str = Field(..., min_length=1, max_length=50, description="Unique institutional roll number", examples=["CS2026-042"])
    department: str = Field(..., min_length=2, max_length=100, description="Academic department or stream", examples=["Computer Science"])
    semester: str = Field(..., min_length=2, max_length=50, description="Current semester of study", examples=["Semester 5"])

    # Subject Marks: Constraint validation (0 <= marks <= 100)
    mathematics: float = Field(..., ge=0.0, le=100.0, description="Mathematics score (0-100)", examples=[85.0])
    physics: float = Field(..., ge=0.0, le=100.0, description="Physics score (0-100)", examples=[78.0])
    computer_science: float = Field(..., ge=0.0, le=100.0, description="Computer Science score (0-100)", examples=[92.0])
    english: float = Field(..., ge=0.0, le=100.0, description="English score (0-100)", examples=[80.0])
    chemistry: float = Field(..., ge=0.0, le=100.0, description="Chemistry score (0-100)", examples=[75.0])


class StudentCreate(StudentBase):
    """Payload schema used when registering a new student (POST /students)"""
    pass


class StudentUpdate(StudentBase):
    """Payload schema used when updating an existing student (PUT /students/{id})"""
    pass


class StudentResponse(StudentBase):
    """
    Response schema returning complete student record including calculated metrics.
    Enables ORM mode (from_attributes=True) to serialize SQLAlchemy models to JSON.
    """
    id: int
    total_marks: float
    percentage: float
    grade: str
    status: str

    model_config = ConfigDict(from_attributes=True)


# ==========================================================================
# Business Logic Helpers (Grades, Percentage, Pass/Fail)
# ==========================================================================

def compute_academic_metrics(
    math: float,
    physics: float,
    cs: float,
    english: float,
    chem: float
) -> tuple[float, float, str, str]:
    """
    Computes total marks, percentage, grade, and pass/fail status.

    Rules:
    - Total marks: sum of 5 subjects (Max: 500)
    - Percentage: (total_marks / 500) * 100
    - Grade brackets:
        90 - 100 = A
        75 - 89  = B
        60 - 74  = C
        40 - 59  = D
        Below 40 = F
    - Passing condition: Every subject must have at least 40 marks (>= 40)
      and overall percentage must be >= 40. Otherwise, status is 'Failed'.
    """
    total_marks = round(math + physics + cs + english + chem, 2)
    percentage = round((total_marks / 500.0) * 100.0, 2)

    # Grade determination
    if percentage >= 90.0:
        grade = "A"
    elif percentage >= 75.0:
        grade = "B"
    elif percentage >= 60.0:
        grade = "C"
    elif percentage >= 40.0:
        grade = "D"
    else:
        grade = "F"

    # Pass/Fail determination (at least 40 marks required in every subject)
    marks_list = [math, physics, cs, english, chem]
    has_failed_subject = any(mark < 40.0 for mark in marks_list)

    if has_failed_subject or percentage < 40.0:
        status = "Failed"
    else:
        status = "Passed"

    return total_marks, percentage, grade, status
