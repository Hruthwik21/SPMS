from flask import Blueprint, jsonify

from app.models import Student, StudentDetail, SgpaCgpaTracker, GradePoint
from app.auth import token_required
from app.services.gpa_calculator import GPACalculator
from app import db

analytics_bp = Blueprint("analytics", __name__)


def _accessible_students(current_user):
    if current_user.department == "ALL":
        return Student.query.all()
    return Student.query.filter_by(department=current_user.department).all()


@analytics_bp.route("/sgpa_cgpa", methods=["GET"])
@token_required
def get_sgpa_cgpa(current_user):
    roll_no = None
    from flask import request
    roll_no = request.args.get("roll_no")

    if roll_no:
        student = Student.query.filter_by(roll_no=roll_no).first()
        if not student:
            return jsonify({"message": "Student not found"}), 404
        if current_user.department != "ALL" and current_user.department != student.department:
            return jsonify({"message": "Access denied"}), 403
        report = GPACalculator.get_student_gpa_report(roll_no)
        return jsonify(report)

    trackers = SgpaCgpaTracker.query.all()
    result = []
    for tracker in trackers:
        student = Student.query.filter_by(roll_no=tracker.roll_no).first()
        if not student:
            continue
        if current_user.department != "ALL" and current_user.department != student.department:
            continue

        sgpa = GPACalculator.calculate_sgpa(tracker.roll_no, tracker.semester)
        cgpa = GPACalculator.calculate_cgpa(tracker.roll_no, tracker.semester)

        result.append({
            "roll_no": tracker.roll_no,
            "name": student.name,
            "department": student.department,
            "academic_year": tracker.academic_year,
            "semester": tracker.semester,
            "sgpa": sgpa,
            "cgpa": cgpa,
        })

    return jsonify(result)


@analytics_bp.route("/pass_stats", methods=["GET"])
@token_required
def get_pass_stats(current_user):
    grade_points = {gp.grade: gp.points for gp in GradePoint.query.all()}
    students = _accessible_students(current_user)

    dept_data = {}
    for student in students:
        dept_data.setdefault(student.department, {"pass": 0, "fail": 0})
        details = StudentDetail.query.filter_by(roll_no=student.roll_no).all()
        for detail in details:
            if not detail.grade:
                continue
            if grade_points.get(detail.grade, 0) > 0:
                dept_data[student.department]["pass"] += 1
            else:
                dept_data[student.department]["fail"] += 1

    result = []
    for dept, counts in dept_data.items():
        total = counts["pass"] + counts["fail"]
        if total > 0:
            result.append({
                "department": dept,
                "pass": counts["pass"],
                "fail": counts["fail"],
                "total": total,
                "passPercentage": round((counts["pass"] / total) * 100, 2),
            })

    return jsonify(result)


@analytics_bp.route("/cgpa_stats", methods=["GET"])
@token_required
def get_cgpa_stats(current_user):
    students = _accessible_students(current_user)

    dept_data = {}
    for student in students:
        dept_data.setdefault(student.department, [])
        highest_sem = db.session.query(db.func.max(SgpaCgpaTracker.semester)).filter_by(roll_no=student.roll_no).scalar()
        if highest_sem:
            cgpa = GPACalculator.calculate_cgpa(student.roll_no, highest_sem)
            if cgpa is not None:
                dept_data[student.department].append(cgpa)

    result = []
    for dept, cgpas in dept_data.items():
        if cgpas:
            result.append({
                "department": dept,
                "avg": round(sum(cgpas) / len(cgpas), 2),
                "min": round(min(cgpas), 2),
                "max": round(max(cgpas), 2),
                "count": len(cgpas),
            })

    return jsonify(result)


@analytics_bp.route("/course_performance", methods=["GET"])
@token_required
def get_course_performance(current_user):
    from flask import request
    course_code = request.args.get("course_code")

    if course_code:
        return jsonify(GPACalculator.get_course_performance(course_code))

    from app.models import Course
    courses = Course.query.all()
    result = [GPACalculator.get_course_performance(c.course_code) for c in courses]
    return jsonify([r for r in result if r is not None])


@analytics_bp.route("/departments", methods=["GET"])
@token_required
def get_departments(current_user):
    from sqlalchemy import func
    depts = db.session.query(Student.department, func.count(Student.roll_no)).group_by(Student.department).all()
    return jsonify([{"department": d[0], "student_count": d[1]} for d in depts])


@analytics_bp.route("/dashboard_summary", methods=["GET"])
@token_required
def dashboard_summary(current_user):
    students = _accessible_students(current_user)
    total_students = len(students)

    from app.models import Course, Mark
    total_courses = Course.query.count()
    total_marks = Mark.query.count()

    dept_counts = {}
    for s in students:
        dept_counts[s.department] = dept_counts.get(s.department, 0) + 1

    recent_details = StudentDetail.query.order_by(StudentDetail.id.desc()).limit(5).all()
    recent = []
    for d in recent_details:
        student = Student.query.filter_by(roll_no=d.roll_no).first()
        if student and (current_user.department == "ALL" or current_user.department == student.department):
            recent.append({
                "roll_no": d.roll_no,
                "name": student.name,
                "course_code": d.course_code,
                "semester": d.semester,
                "grade": d.grade,
            })

    return jsonify({
        "total_students": total_students,
        "total_courses": total_courses,
        "total_marks": total_marks,
        "department_counts": dept_counts,
        "recent_entries": recent,
    })
