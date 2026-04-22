-- Check current state of monthly_fee
SELECT id, name, monthly_fee, notes
FROM students
ORDER BY monthly_fee DESC NULLS LAST
LIMIT 20;

-- Count students with/without monthly_fee
SELECT 
  COUNT(*) as total,
  COUNT(monthly_fee) as has_fee,
  COUNT(*) - COUNT(monthly_fee) as missing_fee
FROM students;
