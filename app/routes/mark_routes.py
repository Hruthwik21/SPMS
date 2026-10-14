from flask import Blueprint, request, jsonify

from app import db
from app.models import Mark, Student, Course
from app.auth import token_required

mark_bp = Blueprint("marks", __name__)


def _accessible_students_query(current_user):
    if current_user.department == "ALL":
        return Student.query
    return Student.query.filter_by(department=current_user.department)


@mark_bp.route("/marks", methods=["GET"])
@token_required
def get_marks(current_user):
    roll_no = request.args.get("roll_no")
    course_code = request.args.get("course_code")

    query = Mark.query.join(Student, Mark.roll_no == Student.roll_no)
    accessible_roll_nos = [s.roll_no for s in _accessible_students_query(current_user).all()]
    query = query.filter(Mark.roll_no.in_(accessible_roll_nos))

    if roll_no:
        query = query.filter(Mark.roll_no == roll_no)
    if course_code:
        query = query.filter(Mark.course_code == course_code)

    marks = query.all()
    return jsonify([m.to_dict() for m in marks])


@mark_bp.route("/marks", methods=["POST"])
@token_required
def add_mark(current_user):
    data = request.get_json()

    if not data or not data.get("roll_no") or not data.get("course_code"):
        return jsonify({"message": "Missing required fields"}), 400

    student = Student.query.filter_by(roll_no=data["roll_no"]).first()
    if not student:
        return jsonify({"message": "Student not found"}), 404

    if current_user.department != "ALL" and current_user.department != student.department:
        return jsonify({"message": "No permission to add marks for this student"}), 403

    course = Course.query.filter_by(course_code=data["course_code"]).first()
    if not course:
        return jsonify({"message": "Course not found"}), 404

    existing = Mark.query.filter_by(roll_no=data["roll_no"], course_code=data["course_code"]).first()
    if existing:
        for field in ("minor_1", "mid", "minor_2", "endsem"):
            if data.get(field) is not None:
                setattr(existing, field, data[field])
        db.session.commit()
        return jsonify({"message": "Marks updated successfully", "mark": existing.to_dict()})

    mark = Mark(
        roll_no=data["roll_no"],
        course_code=data["course_code"],
        minor_1=data.get("minor_1"),
        mid=data.get("mid"),
        minor_2=data.get("minor_2"),
        endsem=data.get("endsem"),
    )
    db.session.add(mark)
    db.session.commit()

    return jsonify({"message": "Marks added successfully", "mark": mark.to_dict()}), 201


@mark_bp.route("/marks/<int:mark_id>", methods=["PUT"])
@token_required
def update_mark(current_user, mark_id):
    mark = Mark.query.filter_by(id=mark_id).first()
    if not mark:
        return jsonify({"message": "Mark entry not found"}), 404

    student = Student.query.filter_by(roll_no=mark.roll_no).first()
    if current_user.department != "ALL" and current_user.department != student.department:
        return jsonify({"message": "No permission to update marks for this student"}), 403

    data = request.get_json()
    for field in ("minor_1", "mid", "minor_2", "endsem"):
        if data.get(field) is not None:
            setattr(mark, field, data[field])

    db.session.commit()
    return jsonify({"message": "Marks updated successfully", "mark": mark.to_dict()})


@mark_bp.route("/marks/<int:mark_id>", methods=["DELETE"])
@token_required
def delete_mark(current_user, mark_id):
    mark = Mark.query.filter_by(id=mark_id).first()
    if not mark:
        return jsonify({"message": "Mark entry not found"}), 404

    student = Student.query.filter_by(roll_no=mark.roll_no).first()
    if current_user.department != "ALL" and current_user.department != student.department:
        return jsonify({"message": "No permission to delete marks for this student"}), 403

    db.session.delete(mark)
    db.session.commit()

    return jsonify({"message": "Mark entry deleted successfully"})
