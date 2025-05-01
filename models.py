from app import db
from flask_login import UserMixin
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    department = db.Column(db.String(50), nullable=False)  # 'ALL' for admin, or specific department code

class Student(db.Model):
    __tablename__ = 'students'
    
    roll_no = db.Column(db.String(20), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(50), nullable=False)
    
    # Relationships
    marks = relationship("Mark", back_populates="student", cascade="all, delete-orphan")
    details = relationship("StudentDetail", back_populates="student", cascade="all, delete-orphan")
    sgpa_cgpa = relationship("SgpaCgpaTracker", back_populates="student", cascade="all, delete-orphan")

class Course(db.Model):
    __tablename__ = 'courses'
    
    course_code = db.Column(db.String(20), primary_key=True)
    course_name = db.Column(db.String(100), nullable=False, unique=True)
    credits = db.Column(db.Integer, nullable=False)
    
    # Relationships
    marks = relationship("Mark", back_populates="course", cascade="all, delete-orphan")
    student_details = relationship("StudentDetail", back_populates="course", cascade="all, delete-orphan")

class Mark(db.Model):
    __tablename__ = 'marks'
    
    id = db.Column(db.Integer, primary_key=True)
    roll_no = db.Column(db.String(20), ForeignKey('students.roll_no', ondelete='CASCADE'), nullable=False)
    course_code = db.Column(db.String(20), ForeignKey('courses.course_code', ondelete='CASCADE'), nullable=False)
    minor_1 = db.Column(db.Float)
    mid = db.Column(db.Float)
    minor_2 = db.Column(db.Float)
    endsem = db.Column(db.Float)
    
    # Unique constraint
    __table_args__ = (
        db.UniqueConstraint('roll_no', 'course_code', name='unique_student_course_mark'),
    )
    
    # Relationships
    student = relationship("Student", back_populates="marks")
    course = relationship("Course", back_populates="marks")

class StudentDetail(db.Model):
    __tablename__ = 'student_details'
    
    id = db.Column(db.Integer, primary_key=True)
    roll_no = db.Column(db.String(20), ForeignKey('students.roll_no', ondelete='CASCADE'), nullable=False)
    course_code = db.Column(db.String(20), ForeignKey('courses.course_code', ondelete='CASCADE'), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    academic_year = db.Column(db.String(20), nullable=False)
    grade = db.Column(db.String(5))
    
    # Unique constraint
    __table_args__ = (
        db.UniqueConstraint('roll_no', 'course_code', 'semester', name='unique_student_course_sem'),
    )
    
    # Relationships
    student = relationship("Student", back_populates="details")
    course = relationship("Course", back_populates="student_details")

class SgpaCgpaTracker(db.Model):
    __tablename__ = 'sgpa_cgpa_tracker'
    
    id = db.Column(db.Integer, primary_key=True)
    roll_no = db.Column(db.String(20), ForeignKey('students.roll_no', ondelete='CASCADE'), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    academic_year = db.Column(db.String(20), nullable=False)
    
    # Unique constraint
    __table_args__ = (
        db.UniqueConstraint('roll_no', 'semester', name='unique_student_semester'),
    )
    
    # Relationships
    student = relationship("Student", back_populates="sgpa_cgpa")

class GradePoint(db.Model):
    __tablename__ = 'grade_points'
    
    id = db.Column(db.Integer, primary_key=True)
    grade = db.Column(db.String(5), unique=True, nullable=False)
    points = db.Column(db.Float, nullable=False)