$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
}

$url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

Write-Host "Fetching all students..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers -TimeoutSec 30
Write-Host "Total: $($response.Count)" -ForegroundColor Yellow

$toDelete = $response | Where-Object { $_.name -like "*POONTHALIR*" -and $_.name -like "*&*" }
Write-Host "Found $($toDelete.Count) records with '&'" -ForegroundColor Yellow

foreach ($s in $toDelete) {
    Write-Host "Deleting: $($s.name) (ID: $($s.id))" -ForegroundColor Red
    $delUrl = "$url?id=$($s.id)"
    try {
        Invoke-RestMethod -Uri $delUrl -Method DELETE -Headers $headers -TimeoutSec 30 | Out-Null
        Write-Host "  Deleted OK" -ForegroundColor Green
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$remaining = (Invoke-RestMethod -Uri $url -Method GET -Headers $headers -TimeoutSec 30).Count
Write-Host ""
Write-Host "Remaining students: $remaining" -ForegroundColor Cyan