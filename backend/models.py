from sqlalchemy import Column, Integer, String, Float
from database import Base


class Student(Base):
    """
    SQLAlchemy ORM Model representing the 'students' table in SQLite.
    Stores personal, academic, mark breakdowns, and computed performance results.
    """
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    roll_number = Column(String(50), unique=True, index=True, nullable=False)
    department = Column(String(100), nullable=False)
    semester = Column(String(50), nullable=False)

    # Individual Subject Marks (Max: 100 Each)
    mathematics = Column(Float, nullable=False)
    physics = Column(Float, nullable=False)
    computer_science = Column(Float, nullable=False)
    english = Column(Float, nullable=False)
    chemistry = Column(Float, nullable=False)

    # Computed Academic Metrics
    total_marks = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False)
    grade = Column(String(10), nullable=False)
    status = Column(String(20), nullable=False)

    def __repr__(self):
        return f"<Student(id={self.id}, name='{self.name}', roll_number='{self.roll_number}', percentage={self.percentage}%)>"
