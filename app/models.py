from app import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    department = db.Column(db.String(50), nullable=False, default="ALL")
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "department": self.department,
        }


class Student(db.Model):
    __tablename__ = "students"

    roll_no = db.Column(db.String(20), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(50), nullable=False, index=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    marks = db.relationship("Mark", back_populates="student", cascade="all, delete-orphan")
    details = db.relationship("StudentDetail", back_populates="student", cascade="all, delete-orphan")
    sgpa_cgpa = db.relationship("SgpaCgpaTracker", back_populates="student", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "rollNo": self.roll_no,
            "name": self.name,
            "department": self.department,
        }


class Course(db.Model):
    __tablename__ = "courses"

    course_code = db.Column(db.String(20), primary_key=True)
    course_name = db.Column(db.String(100), nullable=False, unique=True)
    credits = db.Column(db.Integer, nullable=False)

    marks = db.relationship("Mark", back_populates="course", cascade="all, delete-orphan")
    student_details = db.relationship("StudentDetail", back_populates="course", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "course_code": self.course_code,
            "course_name": self.course_name,
            "credits": self.credits,
        }


class Mark(db.Model):
    __tablename__ = "marks"

    id = db.Column(db.Integer, primary_key=True)
    roll_no = db.Column(db.String(20), db.ForeignKey("students.roll_no", ondelete="CASCADE"), nullable=False)
    course_code = db.Column(db.String(20), db.ForeignKey("courses.course_code", ondelete="CASCADE"), nullable=False)
    minor_1 = db.Column(db.Float)
    mid = db.Column(db.Float)
    minor_2 = db.Column(db.Float)
    endsem = db.Column(db.Float)

    __table_args__ = (
        db.UniqueConstraint("roll_no", "course_code", name="unique_student_course_mark"),
    )

    student = db.relationship("Student", back_populates="marks")
    course = db.relationship("Course", back_populates="marks")

    def to_dict(self):
        return {
            "roll_no": self.roll_no,
            "course_code": self.course_code,
            "minor_1": self.minor_1,
            "mid": self.mid,
            "minor_2": self.minor_2,
            "endsem": self.endsem,
        }


class StudentDetail(db.Model):
    __tablename__ = "student_details"

    id = db.Column(db.Integer, primary_key=True)
    roll_no = db.Column(db.String(20), db.ForeignKey("students.roll_no", ondelete="CASCADE"), nullable=False)
    course_code = db.Column(db.String(20), db.ForeignKey("courses.course_code", ondelete="CASCADE"), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    academic_year = db.Column(db.String(20), nullable=False)
    grade = db.Column(db.String(5))

    __table_args__ = (
        db.UniqueConstraint("roll_no", "course_code", "semester", name="unique_student_course_sem"),
    )

    student = db.relationship("Student", back_populates="details")
    course = db.relationship("Course", back_populates="student_details")

    def to_dict(self):
        return {
            "roll_no": self.roll_no,
            "course_code": self.course_code,
            "semester": self.semester,
            "academic_year": self.academic_year,
            "grade": self.grade,
        }


class SgpaCgpaTracker(db.Model):
    __tablename__ = "sgpa_cgpa_tracker"

    id = db.Column(db.Integer, primary_key=True)
    roll_no = db.Column(db.String(20), db.ForeignKey("students.roll_no", ondelete="CASCADE"), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    academic_year = db.Column(db.String(20), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("roll_no", "semester", name="unique_student_semester"),
    )

    student = db.relationship("Student", back_populates="sgpa_cgpa")


class GradePoint(db.Model):
    __tablename__ = "grade_points"

    id = db.Column(db.Integer, primary_key=True)
    grade = db.Column(db.String(5), unique=True, nullable=False)
    points = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {"grade": self.grade, "points": self.points}
