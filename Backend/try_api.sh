#!/bin/bash

API_URL="http://localhost:3000/api"

ADMIN_USERNAME="Admin"
ADMIN_PASS="admin123"

echo "========================================="
echo "      TEMPSFLOW API TEST SCRIPT"
echo "========================================="

# ============================================================
#  AUTH
# ============================================================
echo ""
echo "==> [AUTH] LOGIN AS ADMIN"

ADMIN_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
-H "Content-Type: application/json" \
-d "{\"username\":\"$ADMIN_USERNAME\", \"password\":\"$ADMIN_PASS\"}")

echo "$ADMIN_LOGIN"
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.token // empty')
echo "Admin token: $ADMIN_TOKEN"

# -------------------------------------------------------

echo ""
echo "==> [AUTH] GET CURRENT USER (/me)"

curl -s -X GET "$API_URL/auth/me" \
-H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# ============================================================
#  ADMIN — USERS
# ============================================================
echo ""
echo "========================================="
echo "==> [ADMIN] CREATE NEW EMPLOYEE"

curl -s -X POST "$API_URL/admin/users" \
-H "Authorization: Bearer $ADMIN_TOKEN" \
-H "Content-Type: application/json" \
-d '{"username":"test.employee","password":"TestPass1!","first_name":"Test","last_name":"Employee","role":"employee"}'

echo ""

# -------------------------------------------------------

echo ""
echo "==> [ADMIN] GET ALL USERS"

curl -s -X GET "$API_URL/admin/users" \
-H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# -------------------------------------------------------

echo ""
echo "==> [ADMIN] GET ADMIN USER BY ID"

ADMIN_ID=$(curl -s -X GET "$API_URL/admin/users" \
-H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.users[] | select(.username=="Admin") | .id // empty')

curl -s -X GET "$API_URL/admin/users/$ADMIN_ID" \
-H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# ============================================================
#  CREATE EMPLOYEE AND LOGIN
# ============================================================
echo ""
echo "==> [ADMIN] CREATE TEST EMPLOYEE FOR SHIFT TESTING"

curl -s -X POST "$API_URL/admin/users" \
-H "Authorization: Bearer $ADMIN_TOKEN" \
-H "Content-Type: application/json" \
-d '{"username":"test.employee","password":"TestPass1!","first_name":"Test","last_name":"Employee","role":"employee"}'

echo ""

echo "==> [AUTH] LOGIN AS EMPLOYEE"

EMP_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
-H "Content-Type: application/json" \
-d '{"username":"test.employee","password":"TestPass1!"}')

echo "$EMP_LOGIN"
EMP_TOKEN=$(echo "$EMP_LOGIN" | jq -r '.token // empty')
EMP_ID=$(echo "$EMP_LOGIN" | jq -r '.user.id // empty')
echo "Employee token: $EMP_TOKEN"
echo "Employee ID: $EMP_ID"

# ============================================================
#  SHIFTS
# ============================================================
echo ""
echo "==> [SHIFTS] CLOCK IN"

CLOCK_IN=$(curl -s -X POST "$API_URL/shifts/clock-in" \
-H "Authorization: Bearer $EMP_TOKEN" \
-H "Content-Type: application/json" \
-d "{\"work_date\":\"$(date +%Y-%m-%d)\"}")

echo "$CLOCK_IN"
SHIFT_ID=$(echo "$CLOCK_IN" | jq -r '.shift.id // empty')
echo "Shift ID: $SHIFT_ID"

echo ""
echo "==> [SHIFTS] CLOCK OUT"

curl -s -X POST "$API_URL/shifts/clock-out" \
-H "Authorization: Bearer $EMP_TOKEN" \
-H "Content-Type: application/json" \
-d "{\"shift_id\":$SHIFT_ID}"

echo ""
echo "==> [SHIFTS] GET MY SHIFTS"

curl -s -X GET "$API_URL/shifts/me" \
-H "Authorization: Bearer $EMP_TOKEN"

echo ""
echo "==> [SHIFTS] GET MY SHIFTS BY MONTH"

curl -s -X GET "$API_URL/shifts/me/month/05" \
-H "Authorization: Bearer $EMP_TOKEN"

# ============================================================
#  CORRECTIONS
# ============================================================
echo ""
echo "==> [CORRECTIONS] SUBMIT CORRECTION REQUEST"

CORRECTION=$(curl -s -X POST "$API_URL/shifts/corrections" \
-H "Authorization: Bearer $EMP_TOKEN" \
-H "Content-Type: application/json" \
-d "{\"request_date\":\"$(date +%Y-%m-%d)\",\"correction_type\":\"forgot_clock_out\",\"requested_time\":\"17:30:00\",\"reason\":\"Oubli de badge\"}")

echo "$CORRECTION"
CORRECTION_ID=$(echo "$CORRECTION" | jq -r '.correction.id // empty')

echo ""
echo "==> [CORRECTIONS] GET MY CORRECTIONS"

curl -s -X GET "$API_URL/shifts/corrections/me" \
-H "Authorization: Bearer $EMP_TOKEN"

# ============================================================
#  ADMIN APPROVES CORRECTION
# ============================================================
echo ""
echo "==> [ADMIN] APPROVE CORRECTION"

curl -s -X PATCH "$API_URL/admin/corrections/$CORRECTION_ID" \
-H "Authorization: Bearer $ADMIN_TOKEN" \
-H "Content-Type: application/json" \
-d '{"status":"approved"}'

echo ""

# ============================================================
#  ADMIN — CORRECTIONS
# ============================================================
echo ""
echo "========================================="
echo "==> [ADMIN] GET ALL CORRECTIONS"

curl -s -X GET "$API_URL/admin/corrections" \
-H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# -------------------------------------------------------

echo ""
echo "==> [ADMIN] GET PENDING CORRECTIONS"

curl -s -X GET "$API_URL/admin/corrections/pending" \
-H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# ============================================================
#  ADMIN — SHIFTS
# ============================================================
echo ""
echo "========================================="
echo "==> [ADMIN] GET SHIFTS FOR ADMIN USER"

curl -s -X GET "$API_URL/admin/shifts/$ADMIN_ID" \
-H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# -------------------------------------------------------

echo ""
echo "==> [ADMIN] GET SHIFTS FOR ADMIN USER FILTERED BY MONTH (05)"

curl -s -X GET "$API_URL/admin/shifts/$ADMIN_ID/month/05" \
-H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

# ============================================================
#  ADMIN — DELETE TEST USER (cleanup)
# ============================================================
echo ""
echo "========================================="
echo "==> [ADMIN] DELETE TEST EMPLOYEE (cleanup)"

TEST_USER_ID=$(curl -s -X GET "$API_URL/admin/users" \
-H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.users[] | select(.username=="test.employee") | .id // empty')

curl -s -X DELETE "$API_URL/admin/users/$TEST_USER_ID" \
-H "Authorization: Bearer $ADMIN_TOKEN"

echo ""

echo ""
echo "========================================="
echo "           END OF TEST"
echo "========================================="