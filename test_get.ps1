# Configuration
$ProjectUrl = "https://hrhenmerdrqtfbzcaxrq.supabase.co"
$AnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyaGVubWVyZHJxdGZiemNheHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NzgzMjQsImV4cCI6MjA4NjM1NDMyNH0.8ArH3_ssvMw5cW8zFaPvc61KPlXCBRIU4tmsSBQGnqw"

$Headers = @{
    "apikey" = $AnonKey
    "Authorization" = "Bearer $AnonKey"
}

Write-Host "Testing GET request to $ProjectUrl/rest/v1/contacts..."

try {
    # Fetch last 5 contacts
    $Response = Invoke-RestMethod -Uri "$ProjectUrl/rest/v1/contacts?select=*&limit=5&order=created_at.desc" -Method Get -Headers $Headers
    
    Write-Host "Success! Retrieved contacts:" -ForegroundColor Green
    $Response | Format-Table id, callsign, contacted_callsign, band, mode, qso_date
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    # Try to read detailed error message if available
    Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor DarkRed
}