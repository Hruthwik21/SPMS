import os
import logging
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import generate_password_hash, check_password_hash
import json
import jwt
from datetime import datetime, timedelta
from functools import wraps

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Initialize app
class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "spms-secret-key")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Database configuration
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
db.init_app(app)

# JWT configurations
JWT_SECRET = os.environ.get("JWT_SECRET", "spms-jwt-secret")
JWT_EXPIRATION = 24  # hours

# Import models after db initialization
from models import User, Student, StudentDetail, Mark, SgpaCgpaTracker, Course, GradePoint

# Token required decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            current_user = User.query.filter_by(id=data['id']).first()
            
            if not current_user:
                return jsonify({'message': 'Invalid token'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# Department access check decorator
def dept_access_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        # Admin (ALL department) has access to everything
        if current_user.department == 'ALL':
            return f(current_user, *args, **kwargs)
        
        # If roll_no parameter exists, check department access
        roll_no = request.view_args.get('roll_no') or request.args.get('roll_no') or None
        if roll_no:
            student = Student.query.filter_by(roll_no=roll_no).first()
            if not student:
                return jsonify({'message': 'Student not found'}), 404
                
            if student.department != current_user.department:
                return jsonify({'message': 'You do not have access to this student data'}), 403
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# Initialize database tables
with app.app_context():
    db.create_all()
    
    # Check if users table exists and has entries
    if User.query.count() == 0:
        # Create default admin user
        admin = User(
            username='admin',
            email='admin@example.com',
            password_hash=generate_password_hash('admin123'),
            department='ALL'
        )
        
        # Create department users
        cs_user = User(
            username='cs_dept',
            email='cs@example.com',
            password_hash=generate_password_hash('cs123'),
            department='CSE'
        )
        
        me_user = User(
            username='me_dept',
            email='me@example.com',
            password_hash=generate_password_hash('me123'),
            department='ME'
        )
        
        # Add to database
        db.session.add(admin)
        db.session.add(cs_user)
        db.session.add(me_user)
        
        # Add default grade points if not exists
        if GradePoint.query.count() == 0:
            grade_points = [
                {'grade': 'EX', 'points': 10},
                {'grade': 'A', 'points': 9},
                {'grade': 'B', 'points': 8},
                {'grade': 'C', 'points': 7},
                {'grade': 'D', 'points': 6},
                {'grade': 'E', 'points': 5},
                {'grade': 'P', 'points': 4},
                {'grade': 'F', 'points': 0},
                {'grade': 'R', 'points': 0}
            ]
            
            for gp in grade_points:
                db.session.add(GradePoint(grade=gp['grade'], points=gp['points']))
        
        # Add default courses if not exists
        if Course.query.count() == 0:
            courses = [
                {'course_code': 'CS101', 'course_name': 'Data Structures', 'credits': 3},
                {'course_code': 'CS102', 'course_name': 'Algorithms', 'credits': 4},
                {'course_code': 'MA101', 'course_name': 'Calculus', 'credits': 3},
                {'course_code': 'PH101', 'course_name': 'Physics', 'credits': 4}
            ]
            
            for course in courses:
                db.session.add(Course(
                    course_code=course['course_code'],
                    course_name=course['course_name'],
                    credits=course['credits']
                ))
        
        # Add sample students if not exists
        if Student.query.count() == 0:
            students = [
                {'roll_no': '101', 'name': 'John Doe', 'department': 'CSE'},
                {'roll_no': '102', 'name': 'Jane Smith', 'department': 'CSE'},
                {'roll_no': '201', 'name': 'Mike Johnson', 'department': 'ME'},
                {'roll_no': '202', 'name': 'Sarah Williams', 'department': 'ME'}
            ]
            
            for student in students:
                db.session.add(Student(
                    roll_no=student['roll_no'],
                    name=student['name'],
                    department=student['department']
                ))
            
            # Commit students so they exist for the next steps
            db.session.commit()
            
            # Add some sample student details and grades
            student_details = [
                # Student 101 - semester 1
                {'roll_no': '101', 'course_code': 'CS101', 'semester': 1, 'academic_year': '2023-2024', 'grade': 'A'},
                {'roll_no': '101', 'course_code': 'MA101', 'semester': 1, 'academic_year': '2023-2024', 'grade': 'A'},
                {'roll_no': '101', 'course_code': 'PH101', 'semester': 1, 'academic_year': '2023-2024', 'grade': 'B'},
                
                # Student 101 - semester 2
                {'roll_no': '101', 'course_code': 'CS102', 'semester': 2, 'academic_year': '2023-2024', 'grade': 'A'},
                {'roll_no': '101', 'course_code': 'MA101', 'semester': 2, 'academic_year': '2023-2024', 'grade': 'EX'},
                
                # Student 101 - semester 3
                {'roll_no': '101', 'course_code': 'CS101', 'semester': 3, 'academic_year': '2024-2025', 'grade': 'EX'},
                {'roll_no': '101', 'course_code': 'CS102', 'semester': 3, 'academic_year': '2024-2025', 'grade': 'A'},
                
                # Student 102 - semester 1
                {'roll_no': '102', 'course_code': 'CS101', 'semester': 1, 'academic_year': '2023-2024', 'grade': 'B'},
                {'roll_no': '102', 'course_code': 'MA101', 'semester': 1, 'academic_year': '2023-2024', 'grade': 'C'},
                
                # Student 201 - semester 1
                {'roll_no': '201', 'course_code': 'PH101', 'semester': 1, 'academic_year': '2023-2024', 'grade': 'A'},
                {'roll_no': '201', 'course_code': 'MA101', 'semester': 1, 'academic_year': '2023-2024', 'grade': 'B'},
            ]
            
            for detail in student_details:
                db.session.add(StudentDetail(
                    roll_no=detail['roll_no'],
                    course_code=detail['course_code'],
                    semester=detail['semester'],
                    academic_year=detail['academic_year'],
                    grade=detail['grade']
                ))
            
            # Add SGPA/CGPA tracker entries
            sgpa_entries = [
                {'roll_no': '101', 'semester': 1, 'academic_year': '2023-2024'},
                {'roll_no': '101', 'semester': 2, 'academic_year': '2023-2024'},
                {'roll_no': '101', 'semester': 3, 'academic_year': '2024-2025'},
                {'roll_no': '102', 'semester': 1, 'academic_year': '2023-2024'},
                {'roll_no': '201', 'semester': 1, 'academic_year': '2023-2024'},
            ]
            
            for entry in sgpa_entries:
                db.session.add(SgpaCgpaTracker(
                    roll_no=entry['roll_no'],
                    semester=entry['semester'],
                    academic_year=entry['academic_year']
                ))
        
        # Commit all changes
        db.session.commit()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login.html')
def login_page():
    return render_template('login.html')

@app.route('/perf1.html')
def perf_page():
    return render_template('perf1.html')

@app.route('/analysis.html')
def analysis_page():
    return render_template('analysis.html')

# API Routes
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing username or password'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user:
        return jsonify({'message': 'Invalid username or password'}), 401
    
    # Check if the password directly matches (for demo purposes)
    # or if it matches the hashed password
    valid_password = (user.password_hash == data['password'] or 
                      check_password_hash(user.password_hash, data['password']) or 
                      data['password'] == f"{user.username}123")  # Allow username123 format
    
    if valid_password:
        # Generate JWT token
        token = jwt.encode({
            'id': user.id,
            'username': user.username,
            'department': user.department,
            'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION)
        }, JWT_SECRET, algorithm="HS256")
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'username': user.username,
            'department': user.department
        }), 200
    
    return jsonify({'message': 'Invalid username or password'}), 401

# Students API
@app.route('/students', methods=['GET'])
@token_required
def get_students(current_user):
    if current_user.department == 'ALL':
        students = Student.query.all()
    else:
        students = Student.query.filter_by(department=current_user.department).all()
    
    result = []
    for student in students:
        result.append({
            'rollNo': student.roll_no,
            'name': student.name,
            'department': student.department
        })
    
    return jsonify(result)

@app.route('/students/<roll_no>', methods=['GET'])
@token_required
@dept_access_required
def get_student(current_user, roll_no):
    student = Student.query.filter_by(roll_no=roll_no).first()
    
    if not student:
        return jsonify({'message': 'Student not found'}), 404
    
    return jsonify({
        'rollNo': student.roll_no,
        'name': student.name,
        'department': student.department
    })

@app.route('/students', methods=['POST'])
@token_required
def add_student(current_user):
    data = request.get_json()
    
    if not data or not data.get('roll_no') or not data.get('name') or not data.get('department'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Check if user has permission for this department
    if current_user.department != 'ALL' and current_user.department != data['department']:
        return jsonify({'message': 'You do not have permission to add students to this department'}), 403
    
    # Check if student already exists
    existing_student = Student.query.filter_by(roll_no=data['roll_no']).first()
    if existing_student:
        return jsonify({'message': 'Student with this roll number already exists'}), 400
    
    # Create new student
    new_student = Student(
        roll_no=data['roll_no'],
        name=data['name'],
        department=data['department']
    )
    
    db.session.add(new_student)
    db.session.commit()
    
    return jsonify({'message': 'Student added successfully'}), 201

@app.route('/students/<roll_no>', methods=['DELETE'])
@token_required
@dept_access_required
def delete_student(current_user, roll_no):
    student = Student.query.filter_by(roll_no=roll_no).first()
    
    if not student:
        return jsonify({'message': 'Student not found'}), 404
    
    db.session.delete(student)
    db.session.commit()
    
    return jsonify({'message': 'Student deleted successfully'})

# CGPA/SGPA Calculation Helper
def calculate_gpa(roll_no, semester):
    grade_points = {gp.grade: gp.points for gp in GradePoint.query.all()}
    
    # Get courses for the semester
    semester_details = StudentDetail.query.filter_by(roll_no=roll_no, semester=semester).all()
    
    if not semester_details:
        return None, None
    
    total_credits = 0
    total_points = 0
    
    for detail in semester_details:
        course = Course.query.filter_by(course_code=detail.course_code).first()
        if course and detail.grade in grade_points:
            total_credits += course.credits
            total_points += course.credits * grade_points[detail.grade]
    
    sgpa = total_points / total_credits if total_credits > 0 else 0
    
    # Get all courses up to current semester for CGPA
    all_details = StudentDetail.query.filter(
        StudentDetail.roll_no == roll_no,
        StudentDetail.semester <= semester
    ).all()
    
    cumulative_credits = 0
    cumulative_points = 0
    
    for detail in all_details:
        course = Course.query.filter_by(course_code=detail.course_code).first()
        if course and detail.grade in grade_points:
            cumulative_credits += course.credits
            cumulative_points += course.credits * grade_points[detail.grade]
    
    cgpa = cumulative_points / cumulative_credits if cumulative_credits > 0 else 0
    
    return sgpa, cgpa

# Courses API
@app.route('/courses', methods=['GET'])
@token_required
def get_courses(current_user):
    courses = Course.query.all()
    result = []
    
    for course in courses:
        result.append({
            'course_code': course.course_code,
            'course_name': course.course_name,
            'credits': course.credits
        })
    
    return jsonify(result)

@app.route('/courses', methods=['POST'])
@token_required
def add_course(current_user):
    # Only admin can add courses
    if current_user.department != 'ALL':
        return jsonify({'message': 'Only administrators can add courses'}), 403
    
    data = request.get_json()
    
    if not data or not data.get('course_code') or not data.get('course_name') or not data.get('credits'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Check if course already exists
    existing_course = Course.query.filter_by(course_code=data['course_code']).first()
    if existing_course:
        # Update existing course
        existing_course.course_name = data['course_name']
        existing_course.credits = data['credits']
    else:
        # Create new course
        new_course = Course(
            course_code=data['course_code'],
            course_name=data['course_name'],
            credits=data['credits']
        )
        db.session.add(new_course)
    
    db.session.commit()
    
    return jsonify({'message': 'Course added/updated successfully'}), 201

# Marks API
@app.route('/marks', methods=['GET'])
@token_required
def get_marks(current_user):
    if current_user.department == 'ALL':
        marks = Mark.query.all()
    else:
        # Join with students to filter by department
        students = Student.query.filter_by(department=current_user.department).all()
        student_roll_nos = [s.roll_no for s in students]
        marks = Mark.query.filter(Mark.roll_no.in_(student_roll_nos)).all()
    
    result = []
    for mark in marks:
        result.append({
            'roll_no': mark.roll_no,
            'course_code': mark.course_code,
            'minor_1': mark.minor_1,
            'mid': mark.mid,
            'minor_2': mark.minor_2,
            'endsem': mark.endsem
        })
    
    return jsonify(result)

@app.route('/marks', methods=['POST'])
@token_required
def add_mark(current_user):
    data = request.get_json()
    
    if not data or not data.get('roll_no') or not data.get('course_code'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Check if student exists and user has permission
    student = Student.query.filter_by(roll_no=data['roll_no']).first()
    if not student:
        return jsonify({'message': 'Student not found'}), 404
    
    if current_user.department != 'ALL' and current_user.department != student.department:
        return jsonify({'message': 'You do not have permission to add marks for this student'}), 403
    
    # Check if course exists
    course = Course.query.filter_by(course_code=data['course_code']).first()
    if not course:
        return jsonify({'message': 'Course not found'}), 404
    
    # Check if mark entry already exists
    existing_mark = Mark.query.filter_by(roll_no=data['roll_no'], course_code=data['course_code']).first()
    if existing_mark:
        # Update existing mark
        existing_mark.minor_1 = data.get('minor_1', existing_mark.minor_1)
        existing_mark.mid = data.get('mid', existing_mark.mid)
        existing_mark.minor_2 = data.get('minor_2', existing_mark.minor_2)
        existing_mark.endsem = data.get('endsem', existing_mark.endsem)
    else:
        # Create new mark entry
        new_mark = Mark(
            roll_no=data['roll_no'],
            course_code=data['course_code'],
            minor_1=data.get('minor_1'),
            mid=data.get('mid'),
            minor_2=data.get('minor_2'),
            endsem=data.get('endsem')
        )
        db.session.add(new_mark)
    
    db.session.commit()
    
    return jsonify({'message': 'Marks added/updated successfully'}), 201

# Student Details API
@app.route('/student_details', methods=['GET'])
@token_required
def get_student_details(current_user):
    if current_user.department == 'ALL':
        details = StudentDetail.query.all()
    else:
        # Join with students to filter by department
        students = Student.query.filter_by(department=current_user.department).all()
        student_roll_nos = [s.roll_no for s in students]
        details = StudentDetail.query.filter(StudentDetail.roll_no.in_(student_roll_nos)).all()
    
    result = []
    for detail in details:
        student = Student.query.filter_by(roll_no=detail.roll_no).first()
        course = Course.query.filter_by(course_code=detail.course_code).first()
        
        result.append({
            'roll_no': detail.roll_no,
            'name': student.name if student else '',
            'department': student.department if student else '',
            'academic_year': detail.academic_year,
            'semester': detail.semester,
            'course_name': course.course_name if course else '',
            'course_code': detail.course_code,
            'credits': course.credits if course else 0,
            'grade': detail.grade
        })
    
    return jsonify(result)

@app.route('/student_details', methods=['POST'])
@token_required
def add_student_detail(current_user):
    data = request.get_json()
    
    if not data or not data.get('roll_no') or not data.get('course_code') or not data.get('semester') or not data.get('academic_year'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Check if student exists and user has permission
    student = Student.query.filter_by(roll_no=data['roll_no']).first()
    if not student:
        return jsonify({'message': 'Student not found'}), 404
    
    if current_user.department != 'ALL' and current_user.department != student.department:
        return jsonify({'message': 'You do not have permission to add details for this student'}), 403
    
    # Check if course exists
    course = Course.query.filter_by(course_code=data['course_code']).first()
    if not course:
        return jsonify({'message': 'Course not found'}), 404
    
    # Check if detail entry already exists
    existing_detail = StudentDetail.query.filter_by(
        roll_no=data['roll_no'], 
        course_code=data['course_code'],
        semester=data['semester']
    ).first()
    
    if existing_detail:
        # Update existing detail
        existing_detail.academic_year = data['academic_year']
        existing_detail.grade = data.get('grade', existing_detail.grade)
    else:
        # Create new detail entry
        new_detail = StudentDetail(
            roll_no=data['roll_no'],
            course_code=data['course_code'],
            semester=data['semester'],
            academic_year=data['academic_year'],
            grade=data.get('grade')
        )
        db.session.add(new_detail)
    
    db.session.commit()
    
    # Update SGPA/CGPA tracker if needed
    tracker = SgpaCgpaTracker.query.filter_by(
        roll_no=data['roll_no'],
        semester=data['semester']
    ).first()
    
    if not tracker:
        new_tracker = SgpaCgpaTracker(
            roll_no=data['roll_no'],
            semester=data['semester'],
            academic_year=data['academic_year']
        )
        db.session.add(new_tracker)
        db.session.commit()
    
    return jsonify({'message': 'Student details added/updated successfully'}), 201

# SGPA/CGPA API
@app.route('/sgpa_cgpa', methods=['GET'])
@token_required
def get_sgpa_cgpa(current_user):
    if current_user.department == 'ALL':
        trackers = SgpaCgpaTracker.query.all()
    else:
        # Join with students to filter by department
        students = Student.query.filter_by(department=current_user.department).all()
        student_roll_nos = [s.roll_no for s in students]
        trackers = SgpaCgpaTracker.query.filter(SgpaCgpaTracker.roll_no.in_(student_roll_nos)).all()
    
    result = []
    for tracker in trackers:
        student = Student.query.filter_by(roll_no=tracker.roll_no).first()
        if not student:
            continue
            
        sgpa, cgpa = calculate_gpa(tracker.roll_no, tracker.semester)
        
        result.append({
            'roll_no': tracker.roll_no,
            'name': student.name,
            'department': student.department,
            'academic_year': tracker.academic_year,
            'semester': tracker.semester,
            'sgpa': sgpa,
            'cgpa': cgpa
        })
    
    return jsonify(result)

@app.route('/sgpa_cgpa', methods=['POST'])
@token_required
def add_sgpa_cgpa(current_user):
    data = request.get_json()
    
    if not data or not data.get('roll_no') or not data.get('semester') or not data.get('academic_year'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Check if student exists and user has permission
    student = Student.query.filter_by(roll_no=data['roll_no']).first()
    if not student:
        return jsonify({'message': 'Student not found'}), 404
    
    if current_user.department != 'ALL' and current_user.department != student.department:
        return jsonify({'message': 'You do not have permission to add SGPA/CGPA for this student'}), 403
    
    # Check if tracker already exists
    existing_tracker = SgpaCgpaTracker.query.filter_by(
        roll_no=data['roll_no'],
        semester=data['semester']
    ).first()
    
    if existing_tracker:
        # Update existing tracker
        existing_tracker.academic_year = data['academic_year']
    else:
        # Create new tracker
        new_tracker = SgpaCgpaTracker(
            roll_no=data['roll_no'],
            semester=data['semester'],
            academic_year=data['academic_year']
        )
        db.session.add(new_tracker)
    
    db.session.commit()
    
    return jsonify({'message': 'SGPA/CGPA tracker added/updated successfully'}), 201

# Grade Points API
@app.route('/grade_points', methods=['GET'])
@token_required
def get_grade_points(current_user):
    grade_points = GradePoint.query.all()
    result = []
    
    for gp in grade_points:
        result.append({
            'grade': gp.grade,
            'points': gp.points
        })
    
    return jsonify(result)

# Pass/Fail Stats API
@app.route('/pass_stats', methods=['GET'])
@token_required
def get_pass_stats(current_user):
    # Get grade points for determining pass/fail
    grade_points = {gp.grade: gp.points for gp in GradePoint.query.all()}
    
    # Query all student details or filter by department
    if current_user.department == 'ALL':
        students = Student.query.all()
    else:
        students = Student.query.filter_by(department=current_user.department).all()
    
    # Group students by department
    dept_students = {}
    for student in students:
        if student.department not in dept_students:
            dept_students[student.department] = []
        dept_students[student.department].append(student.roll_no)
    
    # Calculate pass/fail stats by department
    result = []
    for dept, roll_nos in dept_students.items():
        details = StudentDetail.query.filter(StudentDetail.roll_no.in_(roll_nos)).all()
        
        pass_count = 0
        fail_count = 0
        
        for detail in details:
            # Skip if no grade assigned
            if not detail.grade:
                continue
                
            # Check if the grade indicates pass or fail
            points = grade_points.get(detail.grade, 0)
            if points > 0:
                pass_count += 1
            else:
                fail_count += 1
        
        total = pass_count + fail_count
        if total > 0:
            result.append({
                'department': dept,
                'pass': pass_count,
                'fail': fail_count,
                'total': total,
                'passPercentage': (pass_count / total) * 100
            })
    
    return jsonify(result)

# CGPA Stats API
@app.route('/cgpa_stats', methods=['GET'])
@token_required
def get_cgpa_stats(current_user):
    # Query all students or filter by department
    if current_user.department == 'ALL':
        students = Student.query.all()
    else:
        students = Student.query.filter_by(department=current_user.department).all()
    
    # Group students by department
    dept_students = {}
    for student in students:
        if student.department not in dept_students:
            dept_students[student.department] = []
        dept_students[student.department].append(student.roll_no)
    
    # Calculate CGPA stats by department
    result = []
    for dept, roll_nos in dept_students.items():
        cgpas = []
        
        for roll_no in roll_nos:
            # Get the highest semester for the student
            highest_sem = db.session.query(db.func.max(SgpaCgpaTracker.semester)).filter_by(roll_no=roll_no).scalar()
            if highest_sem:
                _, cgpa = calculate_gpa(roll_no, highest_sem)
                if cgpa is not None:
                    cgpas.append(cgpa)
        
        if cgpas:
            result.append({
                'department': dept,
                'avg': sum(cgpas) / len(cgpas),
                'min': min(cgpas),
                'max': max(cgpas)
            })
    
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)