#!/usr/bin/env python3
"""
ChessKidoo Financial Logic Test - Direct Supabase Edge Function Calls
Tests the revenue pipeline against live deployed API
"""

import requests
import json
import sys
import time
from decimal import Decimal
from typing import Dict, Optional, Tuple

# Direct Supabase Edge Functions (no Vercel proxy needed)
SUPABASE_URL = "https://zznbanjdkwofsvpzybtr.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
API_BASE = f"{SUPABASE_URL}/functions/v1"

HEADERS = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
}

# Test state
original_state = {}
test_student_id = None
test_student_fee = Decimal("1500.00")


def log(msg, level="INFO"):
    symbol = {"INFO": "[i]", "PASS": "[+]", "FAIL": "[-]", "STEP": "[>]"}.get(level, "[i]")
    print(f"{symbol} {msg}")


def api_call(method: str, endpoint: str, payload: dict = None) -> Tuple[int, Optional[dict]]:
    """Call Supabase Edge Function"""
    url = f"{API_BASE}/{endpoint.lstrip('/')}"
    try:
        if method.upper() == "GET":
            resp = requests.get(url, headers=HEADERS, params=payload, timeout=15)
        elif method.upper() == "POST":
            resp = requests.post(url, headers=HEADERS, json=payload, timeout=15)
        elif method.upper() == "PUT":
            resp = requests.put(url, headers=HEADERS, json=payload, timeout=15)
        elif method.upper() == "DELETE":
            resp = requests.delete(url, headers=HEADERS, timeout=15)
        else:
            return 0, None

        try:
            data = resp.json() if resp.content else {}
        except:
            data = {}
        return resp.status_code, data
    except Exception as e:
        print(f"API error {method} {endpoint}: {e}")
        return 0, None


def snapshot_system() -> Dict[str, Decimal]:
    """Get current system financial state"""
    code, students_data = api_call("GET", "/students", {"limit": "1000"})
    students = students_data.get("data", []) if code == 200 else []

    code, payments_data = api_call("GET", "/payments", {"order": "payment_date.desc", "limit": "1000"})
    payments = payments_data.get("data", []) if code == 200 else []

    total_students = len(students)
    collected_revenue = sum(Decimal(str(p.get("amount", "0"))) for p in payments if p.get("status") == "paid")
    projected_revenue = sum(
        Decimal(str(s.get("monthly_fee", "0") or s.get("fee", "0") or "0"))
        for s in students
    )
    total_outstanding = projected_revenue - collected_revenue

    log(f"Snapshot: Students={total_students}, Collected=Rs.{collected_revenue}, Outstanding=Rs.{total_outstanding}")

    return {
        "total_students": Decimal(str(total_students)),
        "collected_revenue": collected_revenue,
        "projected_revenue": projected_revenue,
        "total_outstanding": total_outstanding
    }


def assert_eq(actual, expected, label: str) -> bool:
    if abs(Decimal(actual) - Decimal(expected)) < Decimal("0.01"):
        log(f"{label}: PASS", "PASS")
        return True
    else:
        log(f"{label}: expected {expected}, got {actual}", "FAIL")
        return False


# ============================================
# TESTS
# ============================================

def test_01_capture_state():
    global original_state
    log("STEP 1: Capturing current system state...", "STEP")
    original_state = snapshot_system()
    if original_state["total_students"] <= 0:
        raise AssertionError("No students found in system")
    log("Baseline captured", "PASS")


def test_02_create_student():
    global test_student_id
    log("STEP 2: Creating test student (Pending)...", "STEP")

    payload = {
        "full_name": "QA TEST STUDENT",
        "name": "QA TEST STUDENT",
        "parent_phone": "9999999999",
        "level": "Beginner",
        "rating": 800,
        "coach_id": None,
        "enrollment_date": "2026-05-04",
        "monthly_fee": float(test_student_fee),
        "fee": float(test_student_fee),
        "session_mode": "Group",
        "session_time": "17:00",
        "status": "active",
        "payment_status": "Pending"
    }

    code, resp = api_call("POST", "/students", payload)
    if code not in (200, 201):
        log(f"Create failed: HTTP {code} {resp}", "FAIL")
        raise AssertionError("Student creation failed")

    test_student_id = resp.get("id")
    if not test_student_id:
        raise AssertionError("No student ID returned")

    log(f"Student created: {test_student_id}")

    state = snapshot_system()

    ok = True
    ok &= assert_eq(state["total_students"], original_state["total_students"] + 1, "Total Students +1")
    ok &= assert_eq(state["total_outstanding"], original_state["total_outstanding"] + test_student_fee, "Outstanding + fee")
    ok &= assert_eq(state["collected_revenue"], original_state["collected_revenue"], "Collected Revenue unchanged")

    if not ok:
        raise AssertionError("Create-student assertions failed")

    log("Create test passed", "PASS")


def test_03_mark_paid():
    log("STEP 3: Marking student as Paid...", "STEP")

    if not test_student_id:
        raise AssertionError("Missing test student ID")

    # Create payment record
    payment = {
        "id": f"py_test_{test_student_id}",
        "student_id": test_student_id,
        "amount": float(test_student_fee),
        "status": "paid",
        "payment_method": "QA Test",
        "transaction_id": f"TXN_QA_{test_student_id}",
        "payment_date": "2026-05-04T00:00:00Z",
        "description": "Automated test payment"
    }
    code, resp = api_call("POST", "/payments", payment)
    if code not in (200, 201):
        log(f"Payment creation failed: HTTP {code}", "FAIL")
        raise AssertionError("Payment creation failed")
    log(f"Payment created: {resp.get('id')}")

    # Update student status to Paid
    code, _ = api_call("PUT", f"/students?id={test_student_id}", {
        "payment_status": "Paid",
        "due_date": "2026-06-01"
    })
    if code != 200:
        log("Warning: Student status update returned HTTP " + str(code), "WARN")

    time.sleep(2)

    state = snapshot_system()

    ok = True
    ok &= assert_eq(state["collected_revenue"], original_state["collected_revenue"] + test_student_fee, "Collected Revenue + fee")
    ok &= assert_eq(state["total_outstanding"], original_state["total_outstanding"], "Outstanding back to baseline")
    ok &= assert_eq(state["total_students"], original_state["total_students"] + 1, "Total Students unchanged")

    if not ok:
        raise AssertionError("Payment assertions failed")

    log("Payment test passed", "PASS")


def test_04_delete_student():
    log("STEP 4: Deleting test student...", "STEP")

    if not test_student_id:
        raise AssertionError("Missing test student ID")

    code, _ = api_call("DELETE", f"/students?id={test_student_id}")
    if code not in (200, 204):
        log(f"Delete failed: HTTP {code}", "FAIL")
        raise AssertionError("Delete failed")

    log(f"Deleted student {test_student_id}")

    time.sleep(1)

    state = snapshot_system()

    ok = True
    ok &= assert_eq(state["total_students"], original_state["total_students"], "Total Students restored")
    ok &= assert_eq(state["collected_revenue"], original_state["collected_revenue"], "Collected Revenue restored")
    ok &= assert_eq(state["total_outstanding"], original_state["total_outstanding"], "Outstanding restored")

    if not ok:
        raise AssertionError("Delete assertions failed")

    log("Delete test passed", "PASS")


def cleanup():
    global test_student_id
    if test_student_id:
        print(f"[i] Cleanup: deleting student {test_student_id}")
        api_call("DELETE", f"/students?id={test_student_id}")
        test_student_id = None


# ============================================
# RUNNER
# ============================================

def main():
    print("=" * 60)
    print("ChessKidoo Financial Logic Test Suite")
    print("=" * 60)
    print()

    try:
        test_01_capture_state()
        test_02_create_student()
        test_03_mark_paid()
        test_04_delete_student()

        print()
        print("=" * 60)
        print("[OK] ALL TESTS PASSED")
        print("=" * 60)
        print()
        print("Summary:")
        print("  Financial state transitions work correctly")
        print("  Revenue calculations are precise and leak-proof")
        print("  System cleans up test data and reverts to baseline")
        print()
        return 0

    except AssertionError as e:
        print()
        print("=" * 60)
        print(f"[FAIL] TEST FAILED: {e}")
        print("=" * 60)
        print()
        cleanup()
        return 1

    except KeyboardInterrupt:
        print()
        print("[WARN] Interrupted")
        cleanup()
        return 130

    except Exception as e:
        print()
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        cleanup()
        return 1


if __name__ == "__main__":
    sys.exit(main())
