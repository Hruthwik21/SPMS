import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

from app.config import config_by_name


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

    logging.basicConfig(
        level=app.config.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    db.init_app(app)

    from app.routes.auth_routes import auth_bp
    from app.routes.student_routes import student_bp
    from app.routes.course_routes import course_bp
    from app.routes.mark_routes import mark_bp
    from app.routes.detail_routes import detail_bp
    from app.routes.analytics_routes import analytics_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(student_bp, url_prefix="/api")
    app.register_blueprint(course_bp, url_prefix="/api")
    app.register_blueprint(mark_bp, url_prefix="/api")
    app.register_blueprint(detail_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api")

    from app.models import User, GradePoint, Course

    with app.app_context():
        db.create_all()
        if not app.config.get("TESTING"):
            _seed_initial_data(User, GradePoint, Course)

    @app.route("/")
    def index():
        from flask import render_template
        return render_template("base.html")

    @app.route("/login.html")
    def login_page():
        from flask import render_template
        return render_template("login.html")

    @app.route("/dashboard.html")
    def dashboard_page():
        from flask import render_template
        return render_template("dashboard.html")

    @app.route("/analysis.html")
    def analysis_page():
        from flask import render_template
        return render_template("analysis.html")

    @app.errorhandler(404)
    def not_found(_):
        from flask import jsonify
        return jsonify({"message": "Resource not found"}), 404

    @app.errorhandler(500)
    def internal_error(_):
        from flask import jsonify
        db.session.rollback()
        return jsonify({"message": "Internal server error"}), 500

    return app


def _seed_initial_data(User, GradePoint, Course):
    if User.query.count() == 0:
        from werkzeug.security import generate_password_hash

        users = [
            User(username="admin", email="admin@spms.edu",
                 password_hash=generate_password_hash("admin123"),
                 department="ALL"),
            User(username="cs_dept", email="cs@spms.edu",
                 password_hash=generate_password_hash("cs123"),
                 department="CSE"),
            User(username="me_dept", email="me@spms.edu",
                 password_hash=generate_password_hash("me123"),
                 department="ME"),
            User(username="ee_dept", email="ee@spms.edu",
                 password_hash=generate_password_hash("ee123"),
                 department="EE"),
        ]
        for u in users:
            db.session.add(u)

    if GradePoint.query.count() == 0:
        grade_points = [
            ("EX", 10), ("A", 9), ("B", 8), ("C", 7),
            ("D", 6), ("E", 5), ("P", 4), ("F", 0), ("R", 0),
        ]
        for grade, points in grade_points:
            db.session.add(GradePoint(grade=grade, points=points))

    if Course.query.count() == 0:
        courses = [
            ("CS101", "Data Structures", 3),
            ("CS102", "Algorithms", 4),
            ("CS201", "Database Systems", 3),
            ("CS202", "Operating Systems", 4),
            ("CS301", "Machine Learning", 3),
            ("MA101", "Calculus", 3),
            ("MA201", "Linear Algebra", 3),
            ("PH101", "Physics", 4),
            ("ME101", "Thermodynamics", 4),
            ("ME201", "Fluid Mechanics", 3),
            ("EE101", "Circuit Analysis", 4),
            ("EE201", "Signals and Systems", 3),
        ]
        for code, name, credits in courses:
            db.session.add(Course(course_code=code, course_name=name, credits=credits))

    db.session.commit()
