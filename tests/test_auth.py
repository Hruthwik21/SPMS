def test_login_success(client):
    res = client.post("/api/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    data = res.get_json()
    assert "token" in data
    assert data["user"]["department"] == "ALL"


def test_login_invalid_password(client):
    res = client.post("/api/login", json={"username": "admin", "password": "wrong"})
    assert res.status_code == 401


def test_login_missing_fields(client):
    res = client.post("/api/login", json={"username": "admin"})
    assert res.status_code == 400


def test_login_nonexistent_user(client):
    res = client.post("/api/login", json={"username": "nobody", "password": "x"})
    assert res.status_code == 401


def test_profile_authenticated(client, auth_headers):
    res = client.get("/api/profile", headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["user"]["username"] == "admin"


def test_profile_no_token(client):
    res = client.get("/api/profile")
    assert res.status_code == 401


def test_change_password(client, auth_headers):
    res = client.post("/api/change-password", headers=auth_headers,
                      json={"old_password": "admin123", "new_password": "newpass123"})
    assert res.status_code == 200

    res2 = client.post("/api/login", json={"username": "admin", "password": "newpass123"})
    assert res2.status_code == 200
