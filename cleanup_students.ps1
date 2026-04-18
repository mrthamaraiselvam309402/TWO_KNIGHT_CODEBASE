$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
    "Content-Type" = "application/json"
}

$validStudentNames = @(
    "ANFAL", "JAYARAJ", "MUKILAN", "VELAVA", "POONTHALIR", "BUVARGAN", "KRISNA",
    "MANAV", "SREELAXMI", "NIGUNAN", "MAGESH NAVEEN", "SADHANA", "SARAN", "RAKISTHA",
    "SALEM", "AARA V", "NAWFEL", "ESWARI SARANVAN", "REVATHI", "AADHAVN - SINGAPORE",
    "SHERVIN", "PRNAVAV", "DEVI BASIC", "JEEVAN BASIC", "ARUNA ADVANCE", "RIYAS",
    "VARUN", "SUDARSAN", "MOHIT BASIC", "ARUN BASIC", "UTTASAN", "SACHIN", "KACHANA",
    "BALAJI GANESH", "ATISH VIDUN", "JAYAKRITHIK", "MOHAMMED RAYAN", "MOHAMMED AAFIQ",
    "SURESHBABU", "SATHYA", "SAKTHI", "PRIYADHARSHINI", "SAKTHULA", "KUMARAPLAYAM CHESS", "MADURAI"
)

$url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

Write-Host "Fetching all students..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers -TimeoutSec 30
    $allStudents = $response
    
    Write-Host "Total students in database: $($allStudents.Count)" -ForegroundColor Yellow
    
    $studentsToDelete = @()
    foreach ($student in $allStudents) {
        $name = $student.name
        $found = $false
        foreach ($validName in $validStudentNames) {
            if ($name -eq $validName) {
                $found = $true
                break
            }
        }
        if (-not $found) {
            $studentsToDelete += $student
        }
    }
    
    Write-Host "Students to DELETE: $($studentsToDelete.Count)" -ForegroundColor Red
    
    $deleteCount = 0
    foreach ($student in $studentsToDelete) {
        $deleteUrl = "$url?id=eq.$($student.id)"
        try {
            Invoke-RestMethod -Uri $deleteUrl -Method DELETE -Headers $headers -TimeoutSec 30 | Out-Null
            $deleteCount++
            Write-Host "[$deleteCount] Deleted: $($student.name)" -ForegroundColor Yellow
        } catch {
            Write-Host "[ERROR] Failed to delete: $($student.name)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Cleanup Complete!" -ForegroundColor Cyan
    Write-Host "Deleted: $deleteCount students" -ForegroundColor Red
    Write-Host "Remaining: $($allStudents.Count - $deleteCount)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}