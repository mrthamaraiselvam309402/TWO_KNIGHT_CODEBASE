$baseUrl = "https://vseombfkrvpffnpgbsnk.supabase.co/functions/v1/students"
$apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Invoke-DeleteRequest($deleteUrl) {
    $req = [System.Net.HttpWebRequest]::Create($deleteUrl)
    $req.Headers.Add("apikey", $apiKey)
    $req.Headers.Add("Authorization", "Bearer $apiKey")
    $req.Method = "DELETE"
    try {
        $resp = $req.GetResponse()
        $resp.Close()
        return $true
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Write-Host "Fetching students..." -ForegroundColor Cyan
$getReq = [System.Net.HttpWebRequest]::Create($baseUrl)
$getReq.Headers.Add("apikey", $apiKey)
$getReq.Headers.Add("Authorization", "Bearer $apiKey")
$getReq.Method = "GET"
$getResp = $getReq.GetResponse()
$getReader = New-Object System.IO.StreamReader($getResp.GetResponseStream())
$getData = $getReader.ReadToEnd()
$getReader.Close()
$allStudents = $getData | ConvertFrom-Json

Write-Host "Total students: $($allStudents.Count)" -ForegroundColor Yellow

$combinedList = $allStudents | Where-Object { $_.name -like "*&*" }
Write-Host "Found $($combinedList.Count) combined records" -ForegroundColor Yellow

foreach ($student in $combinedList) {
    $studentId = $student.id
    $studentName = $student.name
    $deleteUrl = "$baseUrl?id=$studentId"
    
    Write-Host "Deleting: $studentName (ID: $studentId)..." -ForegroundColor Red
    Invoke-DeleteRequest $deleteUrl
}

$finalGetReq = [System.Net.HttpWebRequest]::Create($baseUrl)
$finalGetReq.Headers.Add("apikey", $apiKey)
$finalGetReq.Headers.Add("Authorization", "Bearer $apiKey")
$finalGetReq.Method = "GET"
$finalGetResp = $finalGetReq.GetResponse()
$finalGetReader = New-Object System.IO.StreamReader($finalGetResp.GetResponseStream())
$finalData = $finalGetReader.ReadToEnd()
$finalGetReader.Close()
$finalCount = ($finalData | ConvertFrom-Json).Count

Write-Host ""
Write-Host "Final count: $finalCount" -ForegroundColor Cyan