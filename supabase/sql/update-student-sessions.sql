-- Update student session data based on user's mapping
-- Run in Supabase SQL Editor

-- ANFAL, JAYARAJ, MUKILAN, VELAVA → GROUP, Fri & Sat
UPDATE students SET session_mode = 'GROUP', session_time = 'Fri & Sat' WHERE full_name IN ('ANFAL', 'JAYARAJ', 'MUKILAN', 'VELAVA');

-- POONTHALIR, BUVARGAN, KRISNA, SREELAXMI, MANAV → GROUP, Morning & Evening
UPDATE students SET session_mode = 'GROUP', session_time = 'Morning & Evening' WHERE full_name IN ('POONTHALIR', 'BUVARGAN', 'KRISNA', 'SREELAXMI', 'MANAV');

-- NIGUNAN, BALAJI GANESH → SINGLE, Weekday
UPDATE students SET session_mode = 'SINGLE', session_time = 'Weekday' WHERE full_name IN ('NIGUNAN', 'BALAJI GANESH');

-- SADHANA, SARAN, RAKISTHA, SALEM, ESWARI, REVATHI, MAGESH, JAYAKRITHIK → GROUP, Weekend
UPDATE students SET session_mode = 'GROUP', session_time = 'Weekend' WHERE full_name IN ('SADHANA', 'SARAN', 'RAKISTHA', 'SALEM', 'ESWARI SARANVAN', 'REVATHI', 'MAGESH NAVEEN', 'JAYAKRITHIK');

-- RAYAN, AAFIQ, AARA V, NAWFEL, SHERVIN, PRNAVAV → GROUP, Weekend
UPDATE students SET session_mode = 'GROUP', session_time = 'Weekend' WHERE full_name IN ('MOHAMMED RAYAN', 'MOHAMMED AAFIQ', 'AARA V', 'NAWFEL', 'SHERVIN', 'PRNAVAV');

-- AADHAVN - SINGAPORE → GROUP, Weekday
UPDATE students SET session_mode = 'GROUP', session_time = 'Weekday' WHERE full_name = 'AADHAVN - SINGAPORE';

-- DEVI BASIC → SINGLE, Weekend
UPDATE students SET session_mode = 'SINGLE', session_time = 'Weekend' WHERE full_name = 'DEVI BASIC';

-- JEEVAN BASIC → SINGLE, Weekday
UPDATE students SET session_mode = 'SINGLE', session_time = 'Weekday' WHERE full_name = 'JEEVAN BASIC';

-- ARUNA ADVANCE, RIYAS, VARUN, SUDARSAN → GROUP, Weekend
UPDATE students SET session_mode = 'GROUP', session_time = 'Weekend' WHERE full_name IN ('ARUNA ADVANCE', 'RIYAS', 'VARUN', 'SUDARSAN');

-- MOHIT BASIC → GROUP, Weekend (Sun & Mon)
UPDATE students SET session_mode = 'GROUP', session_time = 'Weekend (Sun & Mon)' WHERE full_name = 'MOHIT BASIC';

-- ARUN BASIC → SINGLE, Weekday
UPDATE students SET session_mode = 'SINGLE', session_time = 'Weekday' WHERE full_name = 'ARUN BASIC';

-- UTTASAN, SACHIN, ATISH VIDUN → SINGLE, Weekend
UPDATE students SET session_mode = 'SINGLE', session_time = 'Weekend' WHERE full_name IN ('UTTASAN', 'SACHIN', 'ATISH VIDUN');

-- KACHANA → SINGLE, Weekend (Sun & Mon)
UPDATE students SET session_mode = 'SINGLE', session_time = 'Weekend (Sun & Mon)' WHERE full_name = 'KACHANA';

-- SURESHBABU → SINGLE, Weekend
UPDATE students SET session_mode = 'SINGLE', session_time = 'Weekend' WHERE full_name = 'SURESHBABU';

-- SATHYA, SAKTHI → SINGLE, Weekend
UPDATE students SET session_mode = 'SINGLE', session_time = 'Weekend' WHERE full_name IN ('SATHYA', 'SAKTHI');

-- PRIYADHARSHINI, SAKTHULA, KUMARAPLAYAM, MADURAI → GROUP, Weekend
UPDATE students SET session_mode = 'GROUP', session_time = 'Weekend' WHERE full_name IN ('PRIYADHARSHINI', 'SAKTHULA', 'KUMARAPLAYAM CHESS', 'MADURAI');