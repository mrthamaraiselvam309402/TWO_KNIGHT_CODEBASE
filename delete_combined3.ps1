$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
    "Content-Type" = "application/json"
    "Prefer" = "return=minimal"
}

$baseUrl = "https://vseombfkrvpffnpgbsnk.supabase.co/rest/v1/students"

Write-Host "Finding records with '&'..." -ForegroundColor Cyan
$all = Invoke-RestMethod -Uri "$baseUrl?select=id,name" -Method GET -Headers $headers -TimeoutSec 30
$toDelete = $all | Where-Object { $_.name -like "*&*" }

Write-Host "Found: $($toDelete.Count)" -ForegroundColor Yellow

foreach ($s in $toDelete) {
    Write-Host "Deleting: $($s.name) (ID: $($s.id))" -ForegroundColor Red
    $delUrl = "$baseUrl?id=eq.$($s.id)"
    try {
        $result = Invoke-RestMethod -Uri $delUrl -Method DELETE -Headers $headers -TimeoutSec 30
        Write-Host "  OK" -ForegroundColor Green
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$remaining = (Invoke-RestMethod -Uri "$baseUrl?select=id" -Method GET -Headers $headers -TimeoutSec 30).Count
Write-Host ""
Write-Host "Remaining: $remaining" -ForegroundColor Cyan