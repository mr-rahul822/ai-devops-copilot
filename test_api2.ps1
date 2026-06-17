# Full API test with token
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5OTY3YWZmOC00Yjc0LTRjYWUtYmE3Yy1jNmY3MWYyNDEzZWIiLCJlbWFpbCI6InRlc3RlckBleGFtcGxlLmNvbSIsImlhdCI6MTc4MTY2MjU0MCwiZXhwIjoxNzgyMjY3MzQwfQ.89I5VXweLUGoGLLNMc1d7Tp5X7TYGprXFEgVPFFMOQo"
$headers = @{ Authorization = "Bearer $token" }

# Test metrics with auth
Write-Host "=== Metrics Latest (with auth) ===" -ForegroundColor Cyan
try {
    $m = Invoke-RestMethod -Uri "http://localhost:8001/metrics/latest" -Method Get -Headers $headers
    Write-Host ($m | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test alerts
Write-Host "`n=== Alerts ===" -ForegroundColor Cyan
try {
    $a = Invoke-RestMethod -Uri "http://localhost:3003/alerts" -Method Get -Headers $headers
    Write-Host ($a | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# AI Engine — try /ai/health and /ai/analyze
Write-Host "`n=== AI Engine /ai/health ===" -ForegroundColor Cyan
try {
    $ai = Invoke-RestMethod -Uri "http://localhost:8002/ai/health" -Method Get
    Write-Host ($ai | ConvertTo-Json)
} catch {
    Write-Host "AI /ai/health error: $_" -ForegroundColor Yellow
}

Write-Host "`n=== AI Engine root ===" -ForegroundColor Cyan
try {
    $ai2 = Invoke-RestMethod -Uri "http://localhost:8002/" -Method Get
    Write-Host ($ai2 | ConvertTo-Json)
} catch {
    Write-Host "AI root error: $_" -ForegroundColor Yellow
}

# Action Service — /actions
Write-Host "`n=== Action Service /actions ===" -ForegroundColor Cyan
try {
    $actions = Invoke-RestMethod -Uri "http://localhost:8003/actions" -Method Get -Headers $headers
    Write-Host ($actions | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "Actions error: $_" -ForegroundColor Yellow
}

# Metrics service health
Write-Host "`n=== Metrics Health ===" -ForegroundColor Cyan
try {
    $mh = Invoke-RestMethod -Uri "http://localhost:8001/health" -Method Get
    Write-Host ($mh | ConvertTo-Json)
} catch {
    Write-Host "Metrics health error: $_" -ForegroundColor Yellow
}

# Onboarding status
Write-Host "`n=== Onboarding Status ===" -ForegroundColor Cyan
try {
    $on = Invoke-RestMethod -Uri "http://localhost:8001/onboarding/status" -Method Get -Headers $headers
    Write-Host ($on | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "Onboarding status error: $_" -ForegroundColor Yellow
}
