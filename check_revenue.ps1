$url = "https://vseombfkrvpffnpgbsnk.supabase.co/rest/v1/students?select=id,name,status,monthly_fee,notes&limit=100"
$headers = @{
  "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZW9tYmZrcnZwZmZucGdic25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Mzc0MjAsImV4cCI6MjA4OTUxMzQyMH0.wg0Azavs8Gfdbh6vbdjvM6juu45OwpCn4J5XN55tsc8"
}
try {
  $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
  $active = $response | Where-Object { $_.status -eq 'active' }
  $all = $response
  $activeCount = $active.Count
  $activeSum = ($active | Measure-Object -Property monthly_fee -Sum).Sum
  $totalSum = ($all | Measure-Object -Property monthly_fee -Sum).Sum
  Write-Host "Total students: $($all.Count)"
  Write-Host "Active students: $activeCount"
  Write-Host "Sum monthly_fee (active): $activeSum"
  Write-Host "Sum monthly_fee (all): $totalSum"
  Write-Host "`nActive students with monthly_fee > 0:"
  $active | Where-Object { $_.monthly_fee -gt 0 } | Select-Object -First 5 | Format-Table id, name, monthly_fee, notes

  Write-Host "`nStatus distribution:"
  $response | Group-Object -Property status | Select-Object Name, Count | Format-Table -AutoSize
} catch {
  Write-Error $_.Exception.Message
}
