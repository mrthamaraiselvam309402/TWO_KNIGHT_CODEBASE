$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
    "Content-Type" = "application/json"
}

$coachMap = @{
    "VISHNU" = "c_vishnu"
    "ROHIT" = "c_rohit"
    "YOGESH" = "c_yogesh"
    "GYANASURYA" = "c_gyanasurya"
    "HARIS" = "c1775765822776"
    "SARAN" = "76cd4a63-90ef-44d7-a03b-3a4a24eb9249"
    "RANJITH" = "bbc9f0c3-95ac-44bc-843a-72eb2e5e2102"
    "ARIVUSELVAM" = "c_arivuselevam"
    "JERISH" = "90e74588d3769383af3eca35f79a9288"
    "SUDHIN" = "e348a0d74ecc07e5b30860e7117844fb"
}

$students = @(
    @{name="ANFAL"; level="Intermediate 1"; fee=3300; coach="VISHNU"; date="2026-03-22"},
    @{name="JAYARAJ"; level="Intermediate 1"; fee=2500; coach="VISHNU"; date="2026-03-07"},
    @{name="MUKILAN"; level="Intermediate 1"; fee=2000; coach="VISHNU"; date="2026-03-22"},
    @{name="VELAVA"; level="Intermediate 1"; fee=1800; coach="VISHNU"; date="2026-03-22"},
    @{name="POONTHALIR"; level="Intermediate 1"; fee=900; coach="ROHIT"; date="2026-03-22"},
    @{name="BUVARGAN"; level="Intermediate 1"; fee=900; coach="ROHIT"; date="2026-03-22"},
    @{name="KRISNA"; level="Intermediate 1"; fee=600; coach="ROHIT"; date="2026-03-22"},
    @{name="MANAV"; level="Beginner 1"; fee=2200; coach="HARIS"; date="2026-03-22"},
    @{name="SREELAXMI"; level="Beginner 2"; fee=5000; coach="ROHIT"; date="2026-03-10"},
    @{name="NIGUNAN"; level="Beginner 2"; fee=2500; coach="GYANASURYA"; date="2026-03-11"},
    @{name="MAGESH NAVEEN"; level="Beginner 3"; fee=3800; coach="YOGESH"; date="2026-03-14"},
    @{name="SADHANA"; level="Beginner 3"; fee=1500; coach="GYANASURYA"; date="2026-03-22"},
    @{name="SARAN"; level="Beginner 3"; fee=500; coach="GYANASURYA"; date="2026-03-22"},
    @{name="RAKISTHA"; level="Beginner 3"; fee=800; coach="GYANASURYA"; date="2026-03-22"},
    @{name="SALEM"; level="Beginner 2"; fee=1200; coach="GYANASURYA"; date="2026-03-23"},
    @{name="AARA V"; level="Beginner 1"; fee=1800; coach="SARAN"; date="2026-03-12"},
    @{name="NAWFEL"; level="Beginner 1"; fee=1000; coach="SARAN"; date="2026-03-12"},
    @{name="ESWARI SARANVAN"; level="Beginner 1"; fee=1200; coach="GYANASURYA"; date="2026-03-12"},
    @{name="REVATHI"; level="Beginner 1"; fee=1200; coach="GYANASURYA"; date="2026-03-12"},
    @{name="AADHAVN - SINGAPORE"; level="Beginner 1"; fee=2200; coach="SARAN"; date="2026-03-20"},
    @{name="SHERVIN"; level="Beginner 1"; fee=2400; coach="SARAN"; date="2026-03-20"},
    @{name="PRNAVAV"; level="Beginner 1"; fee=2200; coach="HARIS"; date="2026-03-20"},
    @{name="DEVI BASIC"; level="Beginner 1"; fee=2400; coach="HARIS"; date="2026-03-15"},
    @{name="JEEVAN BASIC"; level="Beginner 1"; fee=2300; coach="ARIVUSELVAM"; date="2026-03-15"},
    @{name="ARUNA ADVANCE"; level="Advanced"; fee=2000; coach="RANJITH"; date="2026-03-15"},
    @{name="RIYAS"; level="Advanced 1"; fee=1600; coach="RANJITH"; date="2026-03-15"},
    @{name="VARUN"; level="Advanced 1"; fee=1600; coach="RANJITH"; date="2026-03-15"},
    @{name="SUDARSAN"; level="Advanced 1"; fee=1400; coach="RANJITH"; date="2026-03-15"},
    @{name="MOHIT BASIC"; level="Beginner 1"; fee=1400; coach="YOGESH"; date="2026-03-23"},
    @{name="ARUN BASIC"; level="Beginner 1"; fee=2200; coach="JERISH"; date="2026-03-24"},
    @{name="UTTASAN"; level="Advanced"; fee=3000; coach="ARIVUSELVAM"; date="2026-03-25"},
    @{name="SACHIN"; level="Advanced"; fee=3000; coach="ARIVUSELVAM"; date="2026-03-26"},
    @{name="KACHANA"; level="Beginner"; fee=2500; coach="YOGESH"; date="2026-03-27"},
    @{name="BALAJI GANESH"; level="Beginner"; fee=5200; coach="GYANASURYA"; date="2026-03-14"},
    @{name="ATISH VIDUN"; level="Beginner"; fee=3200; coach="ARIVUSELVAM"; date="2026-03-14"},
    @{name="JAYAKRITHIK"; level="Beginner"; fee=1300; coach="YOGESH"; date="2026-03-14"},
    @{name="MOHAMMED RAYAN"; level="Beginner"; fee=1800; coach="YOGESH"; date="2026-04-13"},
    @{name="MOHAMMED AAFIQ"; level="Beginner"; fee=1800; coach="YOGESH"; date="2026-04-13"},
    @{name="SURESHBABU"; level="Advanced"; fee=3000; coach="YOGESH"; date="2026-04-13"},
    @{name="SATHYA"; level="Beginner"; fee=3500; coach="RANJITH"; date="2026-04-14"},
    @{name="SAKTHI"; level="Beginner"; fee=3500; coach="RANJITH"; date="2026-04-15"},
    @{name="PRIYADHARSHINI"; level="Beginner"; fee=1500; coach="SUDHIN"; date="2026-04-15"},
    @{name="SAKTHULA"; level="Beginner"; fee=1700; coach="SUDHIN"; date="2026-04-15"},
    @{name="KUMARAPLAYAM CHESS"; level="Beginner"; fee=1800; coach="SUDHIN"; date="2026-04-15"},
    @{name="MADURAI"; level="Beginner"; fee=1800; coach="SUDHIN"; date="2026-04-15"}
)

$url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

Write-Host "Starting student update..." -ForegroundColor Cyan
Write-Host "Total students to insert: $($students.Count)" -ForegroundColor Yellow

$successCount = 0
$errorCount = 0

foreach ($student in $students) {
    $coachId = $coachMap[$student.coach]
    if (-not $coachId) {
        Write-Host "Warning: Unknown coach $($student.coach) for $($student.name)" -ForegroundColor Red
        $coachId = $null
    }
    
    $notes = "fee:$($student.fee)"
    
    $body = @{
        name = $student.name
        grade = $student.level
        coach_id = $coachId
        status = "pending"
        notes = $notes
        enrollment_date = $student.date
    } | ConvertTo-Json -Compress
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -Headers $headers -TimeoutSec 30
        $successCount++
        Write-Host "[$successCount] Inserted: $($student.name) - $($student.level) - ₹$($student.fee)" -ForegroundColor Green
    } catch {
        $errorCount++
        $errorMsg = $_.Exception.Message
        Write-Host "[ERROR] $($student.name): $errorMsg" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Update Complete!" -ForegroundColor Cyan
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
Write-Host "========================================" -ForegroundColor Cyan