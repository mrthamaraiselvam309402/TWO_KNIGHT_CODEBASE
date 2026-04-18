$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
}

$url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

Write-Host "Finding 'POONTHALIR & BUVARGAN'..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers -TimeoutSec 30
$combined = $response | Where-Object { $_.name -like "*&*" }

if ($combined) {
    Write-Host "Found: $($combined.name) (ID: $($combined.id))" -ForegroundColor Yellow
    
    $deleteUrl = "$url?id=$($combined.id)"
    Write-Host "Deleting..." -ForegroundColor Red
    Invoke-RestMethod -Uri $deleteUrl -Method DELETE -Headers $headers -TimeoutSec 30
    Write-Host "Deleted successfully!" -ForegroundColor Green
} else {
    Write-Host "Not found" -ForegroundColor Yellow
}