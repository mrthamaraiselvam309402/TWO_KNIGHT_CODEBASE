$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
}

$url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

Write-Host "Fetching students..." -ForegroundColor Cyan

$allStudents = Invoke-RestMethod -Uri $url -Method GET -Headers $headers -TimeoutSec 30
Write-Host "Total students: $($allStudents.Count)" -ForegroundColor Yellow

$combinedList = $allStudents | Where-Object { $_.name -like "*&*" }
Write-Host "Found $($combinedList.Count) combined records" -ForegroundColor Yellow

foreach ($student in $combinedList) {
    $studentId = $student.id
    $studentName = $student.name
    
    $deleteUrl = "$url?id=$([uri]::EscapeDataString($studentId))"
    
    Write-Host "Deleting: $studentName (ID: $studentId)..." -ForegroundColor Red
    
    try {
        $result = Invoke-RestMethod -Uri $deleteUrl -Method DELETE -Headers $headers -TimeoutSec 30
        Write-Host "  Deleted OK" -ForegroundColor Green
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$finalCount = (Invoke-RestMethod -Uri $url -Method GET -Headers $headers -TimeoutSec 30).Count
Write-Host ""
Write-Host "Final student count: $finalCount" -ForegroundColor Cyan