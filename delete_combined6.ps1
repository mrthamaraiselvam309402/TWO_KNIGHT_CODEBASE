$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
}

$url = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"

Write-Host "Fetching students..." -ForegroundColor Cyan
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$req = [System.Net.HttpWebRequest]::Create($url)
$req.Headers = $headers
$req.Method = "GET"
$resp = $req.GetResponse()
$reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
$data = $reader.ReadToEnd()
$reader.Close()
$allStudents = $data | ConvertFrom-Json

Write-Host "Total students: $($allStudents.Count)" -ForegroundColor Yellow

$combinedList = $allStudents | Where-Object { $_.name -like "*&*" }
Write-Host "Found $($combinedList.Count) combined records" -ForegroundColor Yellow

foreach ($student in $combinedList) {
    $studentId = $student.id
    $studentName = $student.name
    
    $deleteUrl = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students?id=$($studentId)"
    
    Write-Host "Deleting: $studentName (ID: $studentId)..." -ForegroundColor Red
    
    try {
        $delReq = [System.Net.HttpWebRequest]::Create($deleteUrl)
        $delReq.Headers = $headers
        $delReq.Method = "DELETE"
        $delResp = $delReq.GetResponse()
        $delResp.Close()
        Write-Host "  OK" -ForegroundColor Green
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$finalReq = [System.Net.HttpWebRequest]::Create($url)
$finalReq.Headers = $headers
$finalReq.Method = "GET"
$finalResp = $finalReq.GetResponse()
$finalReader = New-Object System.IO.StreamReader($finalResp.GetResponseStream())
$finalData = $finalReader.ReadToEnd()
$finalReader.Close()
$finalCount = ($finalData | ConvertFrom-Json).Count

Write-Host ""
Write-Host "Final count: $finalCount" -ForegroundColor Cyan