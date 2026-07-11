import json
import urllib.request

BASE = "http://localhost:4000/api"


def call(method, path, token=None, body=None, expect_json=True):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if expect_json and raw else raw)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def step(label, status, body):
    print(f"\n=== {label} (HTTP {status}) ===")
    if isinstance(body, (dict, list)):
        print(json.dumps(body, indent=2)[:1200])
    else:
        print(str(body)[:300])
    return body


# 1. Superuser login
s, b = call("POST", "/auth/login", body={"email": "superuser@platform.com", "password": "ChangeMe123!"})
step("Superuser login", s, b)
su_token = b["token"]

# 2. Create school (+ first manager)
s, b = call(
    "POST",
    "/schools",
    token=su_token,
    body={
        "name": "Green Hill Secondary School",
        "email": "info@greenhill.rw",
        "manager": {"name": "Jean Uwimana", "email": "jean@greenhill.rw"},
    },
)
b = step("Create school + first manager", s, b)
manager_email = b["manager"]["email"]
manager_temp_password = b["manager"]["temporaryPassword"]

# 3. Manager logs in with temp password
s, b = call("POST", "/auth/login", body={"email": manager_email, "password": manager_temp_password})
b = step("Manager login (temp password)", s, b)
manager_token = b["token"]
assert b["user"]["mustChangePassword"] is True

# 4. Manager changes password
s, b = call("POST", "/auth/change-password", token=manager_token, body={"newPassword": "NewSecurePass123!"})
step("Manager changes password", s, b)

# 5. Manager creates academic year (auto-creates Term 1/2/3)
s, b = call("POST", "/academic-years", token=manager_token, body={"name": "2026-2027"})
b = step("Create academic year", s, b)
year_id = b["academicYear"]["id"]

s, b = call("GET", f"/terms/year/{year_id}", token=manager_token)
b = step("List terms for the year", s, b)
term1_id = next(t["id"] for t in b["terms"] if t["name"] == "Term 1")

# 6. Create a class
s, b = call("POST", "/classes", token=manager_token, body={"name": "S2A", "academicYearId": year_id})
b = step("Create class S2A", s, b)
class_id = b["class"]["id"]

# 7. Create modules
s, b = call("POST", "/modules", token=manager_token, body={"moduleCode": "MATH", "moduleTitle": "Mathematics", "moduleWeight": 3, "passingLine": 50})
b = step("Create Mathematics module", s, b)
math_id = b["module"]["id"]

s, b = call("POST", "/modules", token=manager_token, body={"moduleCode": "ENG", "moduleTitle": "English", "moduleWeight": 2, "passingLine": 50})
b = step("Create English module", s, b)
eng_id = b["module"]["id"]

# 8. Assign modules to class
s, b = call("POST", f"/classes/{class_id}/modules", token=manager_token, body={"moduleIds": [math_id, eng_id]})
step("Assign modules to class", s, b)

# 9. Create a teacher and assign as subject teacher + class teacher
s, b = call("POST", "/teachers", token=manager_token, body={"name": "Alice Teacher", "email": "alice@greenhill.rw"})
b = step("Create teacher", s, b)
teacher_id = b["teacher"]["id"]
teacher_temp_password = b["temporaryPassword"]

s, b = call("POST", "/assignments", token=manager_token, body={"teacherId": teacher_id, "moduleId": math_id, "classId": class_id, "academicYearId": year_id})
step("Assign teacher to Mathematics for S2A", s, b)

s, b = call("POST", f"/classes/{class_id}/assign-teacher", token=manager_token, body={"teacherId": teacher_id})
step("Assign class teacher for S2A", s, b)

# 10. Enroll students
s, b = call("POST", "/students", token=manager_token, body={"classId": class_id, "firstName": "Alice", "lastName": "Mugisha"})
b = step("Enroll student Alice Mugisha", s, b)
student1_id = b["student"]["id"]

s, b = call("POST", "/students", token=manager_token, body={"classId": class_id, "firstName": "Eric", "lastName": "Niyonzima"})
b = step("Enroll student Eric Niyonzima", s, b)
student2_id = b["student"]["id"]

# 11. Teacher logs in and submits marks for Mathematics
s, b = call("POST", "/auth/login", body={"email": "alice@greenhill.rw", "password": teacher_temp_password})
b = step("Subject teacher login", s, b)
teacher_token = b["token"]

s, b = call(
    "POST",
    "/marks",
    token=teacher_token,
    body={
        "classId": class_id,
        "moduleId": math_id,
        "termId": term1_id,
        "entries": [{"studentId": student1_id, "score": 78}, {"studentId": student2_id, "score": 45}],
    },
)
step("Teacher submits Mathematics marks", s, b)

# 11b. Try submitting marks for a module the teacher is NOT assigned to (should be forbidden)
s, b = call(
    "POST",
    "/marks",
    token=teacher_token,
    body={"classId": class_id, "moduleId": eng_id, "termId": term1_id, "entries": [{"studentId": student1_id, "score": 60}]},
)
step("Teacher tries to submit English marks (should be FORBIDDEN)", s, b)

# 11c. Manager submits English marks instead (manager can record for any module)
s, b = call(
    "POST",
    "/marks",
    token=manager_token,
    body={"classId": class_id, "moduleId": eng_id, "termId": term1_id, "entries": [{"studentId": student1_id, "score": 60}, {"studentId": student2_id, "score": 30}]},
)
step("Manager submits English marks", s, b)

# 12. Class teacher adds a remark
s, b = call("PUT", f"/students/{student1_id}/remarks/{term1_id}", token=teacher_token, body={"comment": "Good improvement, keep it up."})
step("Class teacher adds remark for Alice", s, b)

# 13. Get student report (weighted average + pass/fail)
s, b = call("GET", f"/students/{student1_id}/term/{term1_id}/report", token=teacher_token)
step("Alice's Term 1 report", s, b)

s, b = call("GET", f"/students/{student2_id}/term/{term1_id}/report", token=teacher_token)
step("Eric's Term 1 report", s, b)

# 14. Get full class report with ranking
s, b = call("GET", f"/classes/{class_id}/term/{term1_id}/report", token=manager_token)
step("Full class report with ranking", s, b)

# 15. Try to submit marks out of range (should fail validation)
s, b = call("POST", "/marks", token=teacher_token, body={"classId": class_id, "moduleId": math_id, "termId": term1_id, "entries": [{"studentId": student1_id, "score": 150}]})
step("Submit invalid score 150 (should be VALIDATION_ERROR)", s, b)

# 16. Manager locks the term, then teacher tries to submit marks (should be TERM_LOCKED)
s, b = call("PATCH", f"/terms/{term1_id}/lock", token=manager_token, body={"isLocked": True})
step("Manager locks Term 1", s, b)

s, b = call("POST", "/marks", token=teacher_token, body={"classId": class_id, "moduleId": math_id, "termId": term1_id, "entries": [{"studentId": student1_id, "score": 80}]})
step("Teacher tries to edit marks after lock (should be TERM_LOCKED)", s, b)

print("\n\nALL STEPS COMPLETED.")
