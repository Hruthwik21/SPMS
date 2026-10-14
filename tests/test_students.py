def test_get_students_admin(client, auth_headers):
    res = client.get("/api/students", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.get_json()) == 3


def test_get_students_dept_restricted(client, cs_headers):
    res = client.get("/api/students", headers=cs_headers)
    assert res.status_code == 200
    students = res.get_json()
    assert len(students) == 2
    assert all(s["department"] == "CSE" for s in students)


def test_get_student_by_roll_no(client, auth_headers):
    res = client.get("/api/students/101", headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["name"] == "Alice"


def test_get_student_not_found(client, auth_headers):
    res = client.get("/api/students/999", headers=auth_headers)
    assert res.status_code == 404


def test_add_student_admin(client, auth_headers):
    res = client.post("/api/students", headers=auth_headers,
                      json={"roll_no": "301", "name": "New Student", "department": "EE"})
    assert res.status_code == 201


def test_add_student_dept_mismatch(client, cs_headers):
    res = client.post("/api/students", headers=cs_headers,
                      json={"roll_no": "302", "name": "ME Student", "department": "ME"})
    assert res.status_code == 403


def test_add_student_duplicate(client, auth_headers):
    res = client.post("/api/students", headers=auth_headers,
                      json={"roll_no": "101", "name": "Duplicate", "department": "CSE"})
    assert res.status_code == 409


def test_delete_student_admin(client, auth_headers):
    res = client.delete("/api/students/201", headers=auth_headers)
    assert res.status_code == 200


def test_delete_student_dept_forbidden(client, cs_headers):
    res = client.delete("/api/students/201", headers=cs_headers)
    assert res.status_code == 404
