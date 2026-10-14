from flask import Blueprint, request, jsonify

from app import db
from app.models import Course
from app.auth import token_required, admin_required

course_bp = Blueprint("courses", __name__)


@course_bp.route("/courses", methods=["GET"])
@token_required
def get_courses(current_user):
    courses = Course.query.order_by(Course.course_code).all()
    return jsonify([c.to_dict() for c in courses])


@course_bp.route("/courses/<course_code>", methods=["GET"])
@token_required
def get_course(current_user, course_code):
    course = Course.query.filter_by(course_code=course_code).first()
    if not course:
        return jsonify({"message": "Course not found"}), 404
    return jsonify(course.to_dict())


@course_bp.route("/courses", methods=["POST"])
@token_required
@admin_required
def add_course(current_user):
    data = request.get_json()

    if not data or not data.get("course_code") or not data.get("course_name") or data.get("credits") is None:
        return jsonify({"message": "Missing required fields"}), 400

    existing = Course.query.filter_by(course_code=data["course_code"]).first()
    if existing:
        existing.course_name = data["course_name"]
        existing.credits = data["credits"]
        db.session.commit()
        return jsonify({"message": "Course updated successfully", "course": existing.to_dict()})

    course = Course(course_code=data["course_code"], course_name=data["course_name"], credits=data["credits"])
    db.session.add(course)
    db.session.commit()

    return jsonify({"message": "Course added successfully", "course": course.to_dict()}), 201


@course_bp.route("/courses/<course_code>", methods=["PUT"])
@token_required
@admin_required
def update_course(current_user, course_code):
    course = Course.query.filter_by(course_code=course_code).first()
    if not course:
        return jsonify({"message": "Course not found"}), 404

    data = request.get_json()
    if data.get("course_name"):
        course.course_name = data["course_name"]
    if data.get("credits") is not None:
        course.credits = data["credits"]

    db.session.commit()
    return jsonify({"message": "Course updated successfully", "course": course.to_dict()})


@course_bp.route("/courses/<course_code>", methods=["DELETE"])
@token_required
@admin_required
def delete_course(current_user, course_code):
    course = Course.query.filter_by(course_code=course_code).first()
    if not course:
        return jsonify({"message": "Course not found"}), 404

    db.session.delete(course)
    db.session.commit()

    return jsonify({"message": "Course deleted successfully"})
