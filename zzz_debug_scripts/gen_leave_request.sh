API_URL="http://localhost:5000/api/leave-requests"
COOKIE_FILE="cookies.txt"

curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_FILE" \
  -d '{
    "type": "annual",
    "startDate": "2025-10-31T00:00:00.000Z",
    "endDate": "2025-10-31T23:59:59.999Z",
    "days": 1,
    "reason": "Halloween leave"
  }'

