from flask import Blueprint, request, jsonify

from app import db
from app.models import Student
from app.auth import token_required, dept_access_required

student_bp = Blueprint("students", __name__)


@student_bp.route("/students", methods=["GET"])
@token_required
def get_students(current_user):
    department = request.args.get("department")

    if current_user.department == "ALL":
        query = Student.query
        if department:
            query = query.filter_by(department=department)
        students = query.order_by(Student.roll_no).all()
    else:
        students = Student.query.filter_by(department=current_user.department).order_by(Student.roll_no).all()

    return jsonify([s.to_dict() for s in students])


@student_bp.route("/students/<roll_no>", methods=["GET"])
@token_required
@dept_access_required
def get_student(current_user, roll_no):
    student = Student.query.filter_by(roll_no=roll_no).first()
    if not student:
        return jsonify({"message": "Student not found"}), 404
    return jsonify(student.to_dict())


@student_bp.route("/students", methods=["POST"])
@token_required
def add_student(current_user):
    data = request.get_json()

    if not data or not data.get("roll_no") or not data.get("name") or not data.get("department"):
        return jsonify({"message": "Missing required fields"}), 400

    if current_user.department != "ALL" and current_user.department != data["department"]:
        return jsonify({"message": "No permission to add students to this department"}), 403

    if Student.query.filter_by(roll_no=data["roll_no"]).first():
        return jsonify({"message": "Student with this roll number already exists"}), 409

    student = Student(roll_no=data["roll_no"], name=data["name"], department=data["department"])
    db.session.add(student)
    db.session.commit()

    return jsonify({"message": "Student added successfully", "student": student.to_dict()}), 201


@student_bp.route("/students/<roll_no>", methods=["PUT"])
@token_required
@dept_access_required
def update_student(current_user, roll_no):
    student = Student.query.filter_by(roll_no=roll_no).first()
    if not student:
        return jsonify({"message": "Student not found"}), 404

    data = request.get_json()
    if data.get("name"):
        student.name = data["name"]
    if data.get("department"):
        if current_user.department != "ALL" and current_user.department != data["department"]:
            return jsonify({"message": "No permission to move student to this department"}), 403
        student.department = data["department"]

    db.session.commit()
    return jsonify({"message": "Student updated successfully", "student": student.to_dict()})


@student_bp.route("/students/<roll_no>", methods=["DELETE"])
@token_required
@dept_access_required
def delete_student(current_user, roll_no):
    student = Student.query.filter_by(roll_no=roll_no).first()
    if not student:
        return jsonify({"message": "Student not found"}), 404

    db.session.delete(student)
    db.session.commit()

    return jsonify({"message": "Student deleted successfully"})
