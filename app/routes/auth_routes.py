from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash

from app import db
from app.models import User
from app.auth import generate_token, token_required

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data or not data.get("username") or not data.get("password"):
        return jsonify({"message": "Missing username or password"}), 400

    user = User.query.filter_by(username=data["username"]).first()

    if not user or not check_password_hash(user.password_hash, data["password"]):
        return jsonify({"message": "Invalid username or password"}), 401

    token = generate_token(user)

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": user.to_dict(),
    })


@auth_bp.route("/profile", methods=["GET"])
@token_required
def profile(current_user):
    return jsonify({"user": current_user.to_dict()})


@auth_bp.route("/change-password", methods=["POST"])
@token_required
def change_password(current_user):
    data = request.get_json()

    if not data or not data.get("old_password") or not data.get("new_password"):
        return jsonify({"message": "Missing required fields"}), 400

    if not check_password_hash(current_user.password_hash, data["old_password"]):
        return jsonify({"message": "Incorrect current password"}), 401

    if len(data["new_password"]) < 6:
        return jsonify({"message": "New password must be at least 6 characters"}), 400

    from werkzeug.security import generate_password_hash

    current_user.password_hash = generate_password_hash(data["new_password"])
    db.session.commit()

    return jsonify({"message": "Password changed successfully"})
