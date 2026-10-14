from app.services.gpa_calculator import GPACalculator


def test_calculate_sgpa(app):
    with app.app_context():
        sgpa = GPACalculator.calculate_sgpa("101", 1)
        assert sgpa is not None
        assert 0 < sgpa <= 10


def test_calculate_sgpa_no_data(app):
    with app.app_context():
        sgpa = GPACalculator.calculate_sgpa("999", 1)
        assert sgpa is None


def test_calculate_cgpa(app):
    with app.app_context():
        cgpa = GPACalculator.calculate_cgpa("101", 1)
        assert cgpa is not None
        assert 0 < cgpa <= 10


def test_student_gpa_report(app):
    with app.app_context():
        report = GPACalculator.get_student_gpa_report("101")
        assert len(report) == 1
        assert "sgpa" in report[0]
        assert "cgpa" in report[0]


def test_course_performance(app):
    with app.app_context():
        perf = GPACalculator.get_course_performance("CS101")
        assert perf is not None
        assert perf["total_students"] == 2
        assert perf["passed"] == 2
        assert perf["pass_percentage"] == 100.0


def test_course_performance_no_data(app):
    with app.app_context():
        perf = GPACalculator.get_course_performance("XX999")
        assert perf is None


def test_pass_stats(client, auth_headers):
    res = client.get("/api/pass_stats", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data) > 0
    assert "passPercentage" in data[0]


def test_cgpa_stats(client, auth_headers):
    res = client.get("/api/cgpa_stats", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data) > 0


def test_sgpa_cgpa_endpoint(client, auth_headers):
    res = client.get("/api/sgpa_cgpa", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data) > 0


def test_sgpa_cgpa_single_student(client, auth_headers):
    res = client.get("/api/sgpa_cgpa?roll_no=101", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data) == 1
    assert data[0]["roll_no"] == "101"
