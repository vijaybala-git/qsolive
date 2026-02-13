# Configuration
$ProjectUrl = "https://hrhenmerdrqtfbzcaxrq.supabase.co"
$AnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyaGVubWVyZHJxdGZiemNheHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzgzMjQsImV4cCI6MjA4NjM1NDMyNH0.8ArH3_ssvMw5cW8zFaPvc61KPlXCBRIU4tmsSBQGnqw"

$Headers = @{
    "apikey" = $AnonKey
    "Authorization" = "Bearer $AnonKey"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation" # Asks Supabase to return the created record
}

# Sample Data
$Body = @{
    callsign = "W6ABC"
    contacted_callsign = "TEST"
    qso_date = (Get-Date).ToString("yyyy-MM-dd")
    time_on = (Get-Date).ToString("HH:mm:ss")
    band = "10m"
    mode = "SSB"
    operator_callsign = "N6ABC"
    frequency = 14.250
} | ConvertTo-Json

Write-Host "Testing POST request to $ProjectUrl/rest/v1/contacts..."

try {
    $Response = Invoke-RestMethod -Uri "$ProjectUrl/rest/v1/contacts" -Method Post -Headers $Headers -Body $Body
    
    Write-Host "Success! Created contact with ID: $($Response.id)" -ForegroundColor Green
    $Response | Format-List
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to read detailed error message from the response stream
    if ($_.Exception.Response) {
        $Stream = $_.Exception.Response.GetResponseStream()
        $Reader = New-Object System.IO.StreamReader($Stream)
        Write-Host "Details: $($Reader.ReadToEnd())" -ForegroundColor DarkRed
    }
}