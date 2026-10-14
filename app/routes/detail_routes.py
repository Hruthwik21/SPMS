from flask import Blueprint, request, jsonify

from app import db
from app.models import StudentDetail, Student, Course, SgpaCgpaTracker
from app.auth import token_required

detail_bp = Blueprint("details", __name__)


def _accessible_roll_nos(current_user):
    if current_user.department == "ALL":
        return None
    return [s.roll_no for s in Student.query.filter_by(department=current_user.department).all()]


@detail_bp.route("/student_details", methods=["GET"])
@token_required
def get_student_details(current_user):
    roll_no = request.args.get("roll_no")
    semester = request.args.get("semester", type=int)

    query = StudentDetail.query
    accessible = _accessible_roll_nos(current_user)
    if accessible is not None:
        query = query.filter(StudentDetail.roll_no.in_(accessible))

    if roll_no:
        query = query.filter_by(roll_no=roll_no)
    if semester:
        query = query.filter_by(semester=semester)

    details = query.order_by(StudentDetail.roll_no, StudentDetail.semester).all()

    result = []
    for d in details:
        student = Student.query.filter_by(roll_no=d.roll_no).first()
        course = Course.query.filter_by(course_code=d.course_code).first()
        result.append({
            "roll_no": d.roll_no,
            "name": student.name if student else "",
            "department": student.department if student else "",
            "academic_year": d.academic_year,
            "semester": d.semester,
            "course_name": course.course_name if course else "",
            "course_code": d.course_code,
            "credits": course.credits if course else 0,
            "grade": d.grade,
        })

    return jsonify(result)


@detail_bp.route("/student_details", methods=["POST"])
@token_required
def add_student_detail(current_user):
    data = request.get_json()

    required = ("roll_no", "course_code", "semester", "academic_year")
    if not data or any(not data.get(f) for f in required):
        return jsonify({"message": "Missing required fields"}), 400

    student = Student.query.filter_by(roll_no=data["roll_no"]).first()
    if not student:
        return jsonify({"message": "Student not found"}), 404

    if current_user.department != "ALL" and current_user.department != student.department:
        return jsonify({"message": "No permission to add details for this student"}), 403

    course = Course.query.filter_by(course_code=data["course_code"]).first()
    if not course:
        return jsonify({"message": "Course not found"}), 404

    existing = StudentDetail.query.filter_by(
        roll_no=data["roll_no"],
        course_code=data["course_code"],
        semester=data["semester"],
    ).first()

    if existing:
        existing.academic_year = data["academic_year"]
        existing.grade = data.get("grade", existing.grade)
    else:
        existing = StudentDetail(
            roll_no=data["roll_no"],
            course_code=data["course_code"],
            semester=data["semester"],
            academic_year=data["academic_year"],
            grade=data.get("grade"),
        )
        db.session.add(existing)

    db.session.commit()

    tracker = SgpaCgpaTracker.query.filter_by(
        roll_no=data["roll_no"],
        semester=data["semester"],
    ).first()

    if not tracker:
        db.session.add(SgpaCgpaTracker(
            roll_no=data["roll_no"],
            semester=data["semester"],
            academic_year=data["academic_year"],
        ))
        db.session.commit()

    return jsonify({"message": "Student details saved successfully"}), 201


@detail_bp.route("/student_details/<int:detail_id>", methods=["DELETE"])
@token_required
def delete_student_detail(current_user, detail_id):
    detail = StudentDetail.query.filter_by(id=detail_id).first()
    if not detail:
        return jsonify({"message": "Detail entry not found"}), 404

    student = Student.query.filter_by(roll_no=detail.roll_no).first()
    if current_user.department != "ALL" and current_user.department != student.department:
        return jsonify({"message": "No permission to delete this entry"}), 403

    db.session.delete(detail)
    db.session.commit()

    return jsonify({"message": "Student detail deleted successfully"})
