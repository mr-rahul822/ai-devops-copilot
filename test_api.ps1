# Quick API test script
$baseUrl = "http://localhost:3001"

# Test health
Write-Host "=== Testing Health ===" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$baseUrl/auth/health" -Method Get
Write-Host ($health | ConvertTo-Json)

# Test register
Write-Host "`n=== Testing Register ===" -ForegroundColor Cyan
$body = @{ email = "tester@example.com"; password = "Password123!" } | ConvertTo-Json
try {
    $reg = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -ContentType "application/json" -Body $body
    Write-Host ($reg | ConvertTo-Json -Depth 3)
} catch {
    $err = $_.Exception.Response
    $reader = New-Object System.IO.StreamReader($err.GetResponseStream())
    $errBody = $reader.ReadToEnd()
    Write-Host "Register error: $errBody" -ForegroundColor Yellow
}

# Test login
Write-Host "`n=== Testing Login ===" -ForegroundColor Cyan
$loginBody = @{ email = "tester@example.com"; password = "Password123!" } | ConvertTo-Json
try {
    $login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    Write-Host ($login | ConvertTo-Json -Depth 3)
    $token = $login.token
    Write-Host "`nToken: $token" -ForegroundColor Green
} catch {
    $err = $_.Exception.Response
    $reader = New-Object System.IO.StreamReader($err.GetResponseStream())
    $errBody = $reader.ReadToEnd()
    Write-Host "Login error: $errBody" -ForegroundColor Yellow
}

# Test metrics
Write-Host "`n=== Testing Metrics Latest ===" -ForegroundColor Cyan
try {
    $metrics = Invoke-RestMethod -Uri "http://localhost:8001/metrics/latest" -Method Get
    Write-Host ($metrics | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "Metrics error: $_" -ForegroundColor Yellow
}

# Test alerts (with token if we got one)
if ($token) {
    Write-Host "`n=== Testing Alerts ===" -ForegroundColor Cyan
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $alerts = Invoke-RestMethod -Uri "http://localhost:3003/alerts" -Method Get -Headers $headers
        Write-Host ($alerts | ConvertTo-Json -Depth 3)
    } catch {
        $err2 = $_.Exception.Response
        if ($err2) {
            $reader2 = New-Object System.IO.StreamReader($err2.GetResponseStream())
            Write-Host "Alerts error: $($reader2.ReadToEnd())" -ForegroundColor Yellow
        } else {
            Write-Host "Alerts error: $_" -ForegroundColor Yellow
        }
    }
}

# Test AI Engine health
Write-Host "`n=== Testing AI Engine ===" -ForegroundColor Cyan
try {
    $ai = Invoke-RestMethod -Uri "http://localhost:8002/health" -Method Get
    Write-Host ($ai | ConvertTo-Json)
} catch {
    Write-Host "AI Engine error: $_" -ForegroundColor Yellow
}

# Test Action Service health
Write-Host "`n=== Testing Action Service ===" -ForegroundColor Cyan
try {
    $action = Invoke-RestMethod -Uri "http://localhost:8003/health" -Method Get
    Write-Host ($action | ConvertTo-Json)
} catch {
    Write-Host "Action Service error: $_" -ForegroundColor Yellow
}
