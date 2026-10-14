import pytest
from app import create_app, db as _db
from app.models import User, Student, Course, StudentDetail, Mark, GradePoint
from werkzeug.security import generate_password_hash


@pytest.fixture
def app():
    app = create_app("testing")
    with app.app_context():
        _db.create_all()
        _seed_test_data()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db(app):
    return _db


@pytest.fixture
def auth_headers(app):
    with app.app_context():
        user = User.query.filter_by(username="admin").first()
        from app.auth import generate_token
        token = generate_token(user)
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def cs_headers(app):
    with app.app_context():
        user = User.query.filter_by(username="cs_dept").first()
        from app.auth import generate_token
        token = generate_token(user)
        return {"Authorization": f"Bearer {token}"}


def _seed_test_data():
    admin = User(username="admin", email="admin@test.com",
                 password_hash=generate_password_hash("admin123"), department="ALL")
    cs_user = User(username="cs_dept", email="cs@test.com",
                   password_hash=generate_password_hash("cs123"), department="CSE")
    _db.session.add_all([admin, cs_user])

    for grade, points in [("EX", 10), ("A", 9), ("B", 8), ("C", 7), ("D", 6), ("E", 5), ("F", 0)]:
        _db.session.add(GradePoint(grade=grade, points=points))

    _db.session.add_all([
        Course(course_code="CS101", course_name="Data Structures", credits=3),
        Course(course_code="MA101", course_name="Calculus", credits=4),
    ])

    _db.session.add_all([
        Student(roll_no="101", name="Alice", department="CSE"),
        Student(roll_no="102", name="Bob", department="CSE"),
        Student(roll_no="201", name="Charlie", department="ME"),
    ])
    _db.session.commit()

    _db.session.add_all([
        StudentDetail(roll_no="101", course_code="CS101", semester=1, academic_year="2024-25", grade="A"),
        StudentDetail(roll_no="101", course_code="MA101", semester=1, academic_year="2024-25", grade="B"),
        StudentDetail(roll_no="102", course_code="CS101", semester=1, academic_year="2024-25", grade="C"),
    ])
    _db.session.commit()
