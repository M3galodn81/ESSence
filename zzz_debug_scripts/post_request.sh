#/bin/bash

curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt
  # -d '{"username":"john.doe","password":"123456"}' \



