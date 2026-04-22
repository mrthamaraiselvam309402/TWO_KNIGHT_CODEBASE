-- Verify monthly_fee backfill
SELECT 
  id,
  name,
  notes,
  monthly_fee,
  status,
  payment_status
FROM students
ORDER BY monthly_fee;
