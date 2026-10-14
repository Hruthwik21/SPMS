import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import current_app, request, jsonify

from app.models import User


def generate_token(user):
    payload = {
        "id": user.id,
        "username": user.username,
        "department": user.department,
        "exp": datetime.utcnow() + timedelta(hours=current_app.config["JWT_EXPIRATION_HOURS"]),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def decode_token(token):
    return jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization")

        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        if not token:
            return jsonify({"message": "Token is missing"}), 401

        try:
            data = decode_token(token)
            current_user = User.query.filter_by(id=data["id"]).first()
            if not current_user:
                return jsonify({"message": "Invalid token"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401

        return f(current_user, *args, **kwargs)

    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if current_user.department != "ALL":
            return jsonify({"message": "Admin access required"}), 403
        return f(current_user, *args, **kwargs)

    return decorated


def dept_access_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if current_user.department == "ALL":
            return f(current_user, *args, **kwargs)

        roll_no = kwargs.get("roll_no") or request.args.get("roll_no")
        if roll_no:
            from app.models import Student

            student = Student.query.filter_by(roll_no=roll_no).first()
            if not student:
                return jsonify({"message": "Student not found"}), 404
            if student.department != current_user.department:
                return jsonify({"message": "Access denied for this department"}), 403

        return f(current_user, *args, **kwargs)

    return decorated
