#!/bin/bash

API_URL="http://localhost:5000/api/users"
COOKIE_FILE="cookies.txt"

# Loop to create 10 users
for i in $(seq 1 10); do
  USERNAME="user${i}"
  EMAIL="user${i}@example.com"
  EMPLOYEE_ID="EMP-$(printf "%03d" $i)"
  FIRST_NAME="User${i}"
  LAST_NAME="Test"

  echo "Creating user ${USERNAME}..."

  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_FILE" \
    -d "{
      \"username\": \"${USERNAME}\",
      \"password\": \"password${i}\",
      \"email\": \"${EMAIL}\",
      \"firstName\": \"${FIRST_NAME}\",
      \"lastName\": \"${LAST_NAME}\",
      \"role\": \"employee\",
      \"department\": \"Department ${i}\",
      \"position\": \"Staff\",
      \"employeeId\": \"${EMPLOYEE_ID}\",
      \"phoneNumber\": \"0917$(printf "%07d" $((1000000 + $i)))\",
      \"emergencyContact\": {
        \"name\": \"Contact ${i}\",
        \"relationship\": \"Friend\",
        \"phone\": \"0918$(printf "%07d" $((1000000 + $i)))\"
      },
      \"address\": {
        \"street\": \"${i} Main St\",
        \"city\": \"Manila\",
        \"province\": \"Metro Manila\",
        \"zip\": \"1000\"
      },
      \"hireDate\": 1730070000000,
      \"salary\": $((20000 + (i * 1000)))
    }" \
    -w "\nStatus: %{http_code}\n"

done

echo "✅ Done creating users!"
