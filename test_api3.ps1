# Test alerts and full pipeline
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5OTY3YWZmOC00Yjc0LTRjYWUtYmE3Yy1jNmY3MWYyNDEzZWIiLCJlbWFpbCI6InRlc3RlckBleGFtcGxlLmNvbSIsImlhdCI6MTc4MTY2MjU0MCwiZXhwIjoxNzgyMjY3MzQwfQ.89I5VXweLUGoGLLNMc1d7Tp5X7TYGprXFEgVPFFMOQo"
$headers = @{ Authorization = "Bearer $token" }

# 1. Check alerts
Write-Host "=== Alerts ===" -ForegroundColor Cyan
try {
    $a = Invoke-RestMethod -Uri "http://localhost:3003/alerts" -Method Get -Headers $headers
    Write-Host "Alert count: $($a.count)"
    if ($a.alerts -and $a.alerts.Count -gt 0) {
        foreach ($alert in $a.alerts) {
            Write-Host "`n  Alert ID: $($alert.id)"
            Write-Host "  Type: $($alert.type)"
            Write-Host "  Severity: $($alert.severity)"
            Write-Host "  Service: $($alert.service_name)"
            Write-Host "  Message: $($alert.message)"
            Write-Host "  Status: $($alert.status)"
            Write-Host "  Created: $($alert.created_at)"
        }
    } else {
        Write-Host "No alerts found!" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Alerts error: $_" -ForegroundColor Red
}

# 2. Check actions page (should be working now after rate limit resets)
Write-Host "`n=== Actions ===" -ForegroundColor Cyan
try {
    $actions = Invoke-RestMethod -Uri "http://localhost:8003/actions?limit=10" -Method Get -Headers $headers
    Write-Host "Action count: $($actions.count)"
    if ($actions.actions -and $actions.actions.Count -gt 0) {
        foreach ($act in $actions.actions) {
            Write-Host "`n  Action: $($act.action_type) | Status: $($act.status) | Target: $($act.target_service)"
        }
    }
} catch {
    Write-Host "Actions error: $_" -ForegroundColor Red
}

# 3. Check metrics latest
Write-Host "`n=== Latest Metrics ===" -ForegroundColor Cyan
try {
    $m = Invoke-RestMethod -Uri "http://localhost:8001/metrics/latest" -Method Get -Headers $headers
    foreach ($metric in $m) {
        Write-Host "  $($metric.service_name): CPU=$($metric.cpu_percent)% RAM=$($metric.ram_percent)% Region=$($metric.region)"
    }
} catch {
    Write-Host "Metrics error: $_" -ForegroundColor Red
}

# 4. Check AI engine health
Write-Host "`n=== AI Engine Health ===" -ForegroundColor Cyan
try {
    $ai = Invoke-RestMethod -Uri "http://localhost:8002/ai/health" -Method Get
    Write-Host ($ai | ConvertTo-Json)
} catch {
    Write-Host "AI error: $_" -ForegroundColor Red
}

# 5. Action service health
Write-Host "`n=== Action Service Health ===" -ForegroundColor Cyan
try {
    $as = Invoke-RestMethod -Uri "http://localhost:8003/health" -Method Get
    Write-Host ($as | ConvertTo-Json)
} catch {
    Write-Host "Action error: $_" -ForegroundColor Red
}

# 6. Test the AI analyze endpoint
Write-Host "`n=== AI Analysis ===" -ForegroundColor Cyan
$analyzeBody = @{
    service_name = "test2"
    alert_type = "CPU_SPIKE"
    severity = "HIGH"
    current_value = 87.0
} | ConvertTo-Json
try {
    $analysis = Invoke-RestMethod -Uri "http://localhost:8002/ai/analyze" -Method Post -ContentType "application/json" -Body $analyzeBody -Headers $headers
    Write-Host ($analysis | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "AI Analyze error: $_" -ForegroundColor Red
}
