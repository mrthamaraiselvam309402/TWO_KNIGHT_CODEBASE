import { checkRateLimit } from './rate_limit.js'

Deno.serve(async (req) => {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)

  const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'

  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // --- Rate Limiting ---
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rateLimitResult = await checkRateLimit(ip, 'students')
  
  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
    }), { 
      status: 429, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // --- Authentication ---
  const { import_rate_limit } = await import('./rate_limit.js') // Just in case it needs explicit import, but it's already imported at top
  const { validateAuth } = await import('./rate_limit.js')
  
  const auth = await validateAuth(req, supabase)
  if (!auth.allowed) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

   // --- Input Validation Helpers ---
   function sanitizeString(str: unknown, maxLength = 255): string {
     if (typeof str !== 'string') return ''
     return str.slice(0, maxLength).replace(/[<>"'`;]/g, '').trim()
   }

    function validatePhone(phone: unknown): string {
      if (!phone || typeof phone !== 'string') return ''
      const digits = phone.replace(/\D/g, '').slice(0, 15)
      // Accept phone numbers with at least 1 digit to support international numbers
      // Country-specific validation is done in the frontend
      return digits.length >= 1 ? digits : ''
    }

   function validateCountryCode(code: unknown): string {
     if (!code || typeof code !== 'string') return 'IN'
     const upper = code.toUpperCase()
     // List of valid ISO 3166-1 alpha-2 country codes supported by the frontend
     const validCodes = ['IN','US','GB','CA','AU','DE','FR','JP','CN','BR','MX','IT','ES','RU','KR','SG','MY','TH','ID','PH','VN','AE','SA','PK','BD','LK','ZA','NG','EG','NL','BE','SE','NO','DK','FI','PL','TR','IL','AR','CL','CO','NZ','TW']
     return validCodes.includes(upper) ? upper : 'IN'
   }

  function validateRating(rating: unknown): number {
    const num = parseInt(String(rating))
    if (isNaN(num) || num < 0 || num > 3500) return 800
    return num
  }

  function validateStatus(status: unknown): string {
    const valid = ['active', 'pending', 'inactive', 'archived', 'waitlist', 'upcoming']
    return valid.includes(String(status)) ? String(status) : 'pending'
  }

   const COUNTRY_CODES = [
     { code: 'IN', dial: '91', length: 10 },
     { code: 'US', dial: '1', length: 10 },
     { code: 'GB', dial: '44', length: 10 },
     { code: 'CA', dial: '1', length: 10 },
     { code: 'AU', dial: '61', length: 9 },
     { code: 'DE', dial: '49', length: 10 },
     { code: 'FR', dial: '33', length: 9 },
     { code: 'JP', dial: '81', length: 10 },
     { code: 'CN', dial: '86', length: 11 },
     { code: 'BR', dial: '55', length: 10 },
     { code: 'MX', dial: '52', length: 10 },
     { code: 'IT', dial: '39', length: 10 },
     { code: 'ES', dial: '34', length: 9 },
     { code: 'RU', dial: '7', length: 10 },
     { code: 'KR', dial: '82', length: 9 },
     { code: 'SG', dial: '65', length: 8 },
     { code: 'MY', dial: '60', length: 9 },
     { code: 'TH', dial: '66', length: 9 },
     { code: 'ID', dial: '62', length: 10 },
     { code: 'PH', dial: '63', length: 10 },
     { code: 'VN', dial: '84', length: 9 },
     { code: 'AE', dial: '971', length: 9 },
     { code: 'SA', dial: '966', length: 9 },
     { code: 'PK', dial: '92', length: 10 },
     { code: 'BD', dial: '880', length: 10 },
     { code: 'LK', dial: '94', length: 9 },
     { code: 'ZA', dial: '27', length: 9 },
     { code: 'NG', dial: '234', length: 10 },
     { code: 'EG', dial: '20', length: 10 },
     { code: 'NL', dial: '31', length: 9 },
     { code: 'BE', dial: '32', length: 9 },
     { code: 'SE', dial: '46', length: 9 },
     { code: 'NO', dial: '47', length: 8 },
     { code: 'DK', dial: '45', length: 8 },
     { code: 'FI', dial: '358', length: 9 },
     { code: 'PL', dial: '48', length: 9 },
     { code: 'TR', dial: '90', length: 10 },
     { code: 'IL', dial: '972', length: 9 },
     { code: 'AR', dial: '54', length: 10 },
     { code: 'CL', dial: '56', length: 9 },
     { code: 'CO', dial: '57', length: 10 },
     { code: 'NZ', dial: '64', length: 9 },
     { code: 'TW', dial: '886', length: 9 }
   ];

   function parseStoredPhone(phoneStr: string) {
      if (!phoneStr) return { countryCode: 'IN', localNumber: '' };
      const digits = phoneStr.replace(/\D/g, '');
      if (digits.length === 10) {
        if (digits.startsWith('658') || digits.startsWith('659')) {
          return { countryCode: 'SG', localNumber: digits.slice(2) };
        }
        if (digits.startsWith('6') || digits.startsWith('7') || digits.startsWith('8') || digits.startsWith('9')) {
          return { countryCode: 'IN', localNumber: digits };
        }
      }
      const sortedCountries = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
      for (const c of sortedCountries) {
        if (digits.startsWith(c.dial)) {
          const local = digits.slice(c.dial.length);
          if (local.length >= c.length - 2 && local.length <= c.length + 2) {
            return { countryCode: c.code, localNumber: local };
          }
        }
      }
      return { countryCode: 'IN', localNumber: digits };
    }

   // Transform DB row to API response
   function transformStudent(s: Record<string, unknown>) {
     const status = s.status || 'pending';
     const fee = s.monthly_fee ?? s.fee ?? s.fees ?? s.tuition_fee ?? 0;
     const originalPhone = String(s.parent_phone || s.phone || '');
     const parsed = parseStoredPhone(originalPhone);

     return {
       id: s.id,
       name: s.name || '',
       full_name: s.name || '',
       email: s.email || '',
       phone: parsed.localNumber || originalPhone,
       parent_phone: parsed.localNumber || originalPhone,
       parent_name: s.parent_name || '',
       age: s.age || null,
       grade: s.grade || null,
       level: s.grade || 'Beginner',
       enrollment_date: s.enrollment_date || '',
       join_date: s.enrollment_date || '',
       address: s.address || '',
       country_code: (parsed.countryCode && parsed.countryCode !== 'IN') ? parsed.countryCode : (s.country_code || 'IN'),
       status: status,
       payment_status: s.payment_status || (status === 'active' ? 'Paid' : (['pending', 'waitlist', 'upcoming'].includes(status) ? 'Pending' : 'Due')),
       coach_id: s.coach_id || null,
       rating: s.rating || 800,
       current_rating: s.rating || 800,
       notes: s.notes || '',
       learning_mode: s.learning_mode || 'offline',
       session_mode: s.session_mode || null,
       session_time: s.session_time || null,
       batch_type: s.session_mode || null,
       batch_time: s.session_time || null,
       monthly_fee: parseInt(String(fee)) || 0,
       due_date: s.due_date || null,
       account_status: s.account_status || 'active',
       created_at: s.created_at,
       updated_at: s.updated_at
     }
   }

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const method = req.method

     // GET - List all students with pagination
     if (method === 'GET') {
       const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
       const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit') || '100')))
       const offset = (page - 1) * limit
       const search = sanitizeString(url.searchParams.get('search') || '', 100)
       const coachFilter = sanitizeString(url.searchParams.get('coach_id') || '', 50)
       const statusFilter = sanitizeString(url.searchParams.get('status') || '', 50)
       
        let query = supabase
          .from('students_decrypted')  // Use decrypted view to automatically decrypt PII
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
       
       if (search) {
         query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,parent_phone.ilike.%${search}%`)
       }
       if (coachFilter) {
         query = query.eq('coach_id', coachFilter)
       }
       if (statusFilter) {
         query = query.eq('status', statusFilter)
       }
       
       let { data: students, error, count } = await query
       
       if (error) {
         console.warn('Decrypted view query failed, falling back to raw students table:', error.message)
         let fallbackQuery = supabase
           .from('students')
           .select('*', { count: 'exact' })
           .order('created_at', { ascending: false })
           .range(offset, offset + limit - 1)
         
         if (search) {
           fallbackQuery = fallbackQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,parent_phone.ilike.%${search}%`)
         }
         if (coachFilter) {
           fallbackQuery = fallbackQuery.eq('coach_id', coachFilter)
         }
         if (statusFilter) {
           fallbackQuery = fallbackQuery.eq('status', statusFilter)
         }
         
         const fallbackRes = await fallbackQuery
         if (fallbackRes.error) {
           return new Response(JSON.stringify({ error: fallbackRes.error.message }), {
             status: 500,
             headers: { ...corsHeaders, 'Content-Type': 'application/json' }
           })
         }
         students = fallbackRes.data
         count = fallbackRes.count
       }
       
       const transformed = (students || []).map(transformStudent)
       
       return new Response(JSON.stringify({
         data: transformed,
         pagination: {
           page,
           limit,
           total: count || transformed.length,
           total_pages: count ? Math.ceil(count / limit) : 1
         }
       }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       })
      }

    // POST - Create new student
    if (method === 'POST') {
      let rawBody: Record<string, unknown> = {}
      try { rawBody = await req.json() } catch (_e) {}
      
      const name = sanitizeString(rawBody.name || rawBody.full_name, 100)
      if (!name || name.length < 2) {
        return new Response(JSON.stringify({ error: 'Name is required (2-100 characters)' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

       // Encrypt sensitive PII fields
       const parentPhone = validatePhone(rawBody.parent_phone || rawBody.phone)
       const phone = validatePhone(rawBody.phone || rawBody.parent_phone)
       const email = sanitizeString(rawBody.email, 254)
       const address = sanitizeString(rawBody.address, 500)
       const countryCode = validateCountryCode(rawBody.country_code)

       const newStudent: Record<string, unknown> = {
         id: crypto.randomUUID(),
         name: name,
         phone: phone,  // Will be encrypted via trigger
         parent_phone: parentPhone,  // Will be encrypted via trigger
         email: email,  // Will be encrypted via trigger
         address: address,  // Will be encrypted via trigger
         country_code: countryCode,
         parent_name: sanitizeString(rawBody.parent_name, 100),
         age: rawBody.age ? parseInt(String(rawBody.age)) || null : null,
         grade: sanitizeString(rawBody.grade || rawBody.level, 50),
         enrollment_date: sanitizeString(rawBody.enrollment_date || rawBody.join_date, 10) || new Date().toISOString().split('T')[0],
         status: validateStatus(rawBody.status),
         coach_id: rawBody.coach_id ? sanitizeString(String(rawBody.coach_id), 50) : null,
         rating: validateRating(rawBody.rating || rawBody.current_rating),
         session_mode: sanitizeString(rawBody.session_mode || rawBody.batch_type, 50) || null,
         session_time: sanitizeString(rawBody.session_time || rawBody.batch_time, 100) || null,
         monthly_fee: parseInt(String(rawBody.monthly_fee || rawBody.fee)) || 0,
         due_date: rawBody.due_date ? String(rawBody.due_date) : null,
         learning_mode: sanitizeString(rawBody.learning_mode, 50) || 'offline',
         notes: sanitizeString(rawBody.notes, 2000),
         account_status: 'active',
         created_at: new Date().toISOString()
        }
      
      let { data: insertedStudent, error: insertError } = await supabase
        .from('students')
        .insert(newStudent)
        .select('id')
        .single()
      
      if (insertError) {
        if (insertError.message.includes('country_code') || insertError.message.includes('learning_mode') || insertError.code === 'PGRST204') {
          console.warn('country_code or learning_mode column not found, retrying insert without them')
          const fallbackStudent = { ...newStudent }
          delete fallbackStudent.country_code
          delete fallbackStudent.learning_mode
          
          const retryRes = await supabase
            .from('students')
            .insert(fallbackStudent)
            .select('id')
            .single()
          
          insertedStudent = retryRes.data
          insertError = retryRes.error
        }
      }
      
      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      let decryptedStudent = null
      const { data: viewStudent, error: decryptError } = await supabase
        .from('students_decrypted')
        .select('*')
        .eq('id', insertedStudent.id)
        .single()
      
      if (decryptError) {
        console.warn('Decrypted view fetch failed on insert, falling back to raw students table:', decryptError.message)
        const fallbackRes = await supabase
          .from('students')
          .select('*')
          .eq('id', insertedStudent.id)
          .single()
        
        if (fallbackRes.error) {
          return new Response(JSON.stringify({ error: fallbackRes.error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        decryptedStudent = fallbackRes.data
      } else {
        decryptedStudent = viewStudent
      }
      
      return new Response(JSON.stringify(decryptedStudent ? transformStudent(decryptedStudent) : { success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // PUT - Update student
    if (method === 'PUT') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      let rawBody: Record<string, unknown> = {}
      try { rawBody = await req.json() } catch (_e) {}
      
      const updateData: Record<string, unknown> = {}
      
      if (rawBody.name !== undefined || rawBody.full_name !== undefined) {
        updateData.name = sanitizeString(rawBody.name || rawBody.full_name, 100);
      }
      if (rawBody.phone !== undefined) updateData.phone = validatePhone(rawBody.phone);
      if (rawBody.parent_phone !== undefined) updateData.parent_phone = validatePhone(rawBody.parent_phone);
      if (rawBody.email !== undefined) updateData.email = sanitizeString(rawBody.email, 254);
      if (rawBody.age !== undefined) updateData.age = parseInt(String(rawBody.age)) || null;
      if (rawBody.grade !== undefined || rawBody.level !== undefined) {
        updateData.grade = sanitizeString(rawBody.grade || rawBody.level, 50);
      }
      if (rawBody.parent_name !== undefined) updateData.parent_name = sanitizeString(rawBody.parent_name, 100);
      if (rawBody.address !== undefined) updateData.address = sanitizeString(rawBody.address, 500);
      if (rawBody.enrollment_date !== undefined || rawBody.join_date !== undefined) {
        updateData.enrollment_date = sanitizeString(rawBody.enrollment_date || rawBody.join_date, 10);
      }
      if (rawBody.status !== undefined) {
        updateData.status = validateStatus(rawBody.status);
        updateData.account_status = validateStatus(rawBody.status);
      }
      if (rawBody.payment_status !== undefined) {
        const pstatus = String(rawBody.payment_status);
        updateData.payment_status = pstatus;
        
        // Convenience: sync status for backwards compatibility if needed (only if status is not explicitly set)
        if (updateData.status === undefined) {
          const lowStatus = pstatus.toLowerCase();
          if (lowStatus === 'paid') {
            updateData.status = 'active';
            updateData.account_status = 'active';
          } else if (lowStatus === 'pending') {
            updateData.status = 'pending';
            updateData.account_status = 'pending';
          }
        }
      }
      if (rawBody.coach_id !== undefined) updateData.coach_id = rawBody.coach_id ? sanitizeString(String(rawBody.coach_id), 50) : null;
      if (rawBody.rating !== undefined || rawBody.current_rating !== undefined) {
        updateData.rating = validateRating(rawBody.rating || rawBody.current_rating);
      }
      if (rawBody.notes !== undefined) updateData.notes = sanitizeString(rawBody.notes, 2000);
      if (rawBody.session_mode !== undefined || rawBody.batch_type !== undefined) {
        updateData.session_mode = sanitizeString(rawBody.session_mode || rawBody.batch_type, 50);
      }
      if (rawBody.session_time !== undefined || rawBody.batch_time !== undefined) {
        updateData.session_time = sanitizeString(rawBody.session_time || rawBody.batch_time, 100);
      }
      if (rawBody.monthly_fee !== undefined || rawBody.fee !== undefined || rawBody.fees !== undefined || rawBody.tuition_fee !== undefined) {
        const feeVal = parseInt(String(rawBody.monthly_fee ?? rawBody.fee ?? rawBody.fees ?? rawBody.tuition_fee)) || 0;
        updateData.monthly_fee = feeVal;
      }
       if (rawBody.due_date !== undefined) {
         updateData.due_date = rawBody.due_date ? String(rawBody.due_date) : null;
       }
       if (rawBody.learning_mode !== undefined) {
         updateData.learning_mode = sanitizeString(String(rawBody.learning_mode), 50);
       }
       if (rawBody.country_code !== undefined) {
         updateData.country_code = validateCountryCode(rawBody.country_code);
       }
      
      updateData.updated_at = new Date().toISOString();
      
      let { data: updatedStudent, error: updateError } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', id)
        .select('id')
        .single()
      
      if (updateError) {
        if (updateError.message.includes('country_code') || updateError.message.includes('learning_mode') || updateError.code === 'PGRST204') {
          console.warn('country_code or learning_mode column not found, retrying update without them')
          const fallbackData = { ...updateData }
          delete fallbackData.country_code
          delete fallbackData.learning_mode
          
          const retryRes = await supabase
            .from('students')
            .update(fallbackData)
            .eq('id', id)
            .select('id')
            .single()
          
          updatedStudent = retryRes.data
          updateError = retryRes.error
        }
      }
      
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      let decryptedStudent = null
      const { data: viewStudent, error: decryptError } = await supabase
        .from('students_decrypted')
        .select('*')
        .eq('id', id)
        .single()
      
      if (decryptError) {
        console.warn('Decrypted view fetch failed on update, falling back to raw students table:', decryptError.message)
        const fallbackRes = await supabase
          .from('students')
          .select('*')
          .eq('id', id)
          .single()
        
        if (fallbackRes.error) {
          return new Response(JSON.stringify({ error: fallbackRes.error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        decryptedStudent = fallbackRes.data
      } else {
        decryptedStudent = viewStudent
      }
      
      return new Response(JSON.stringify(decryptedStudent ? transformStudent(decryptedStudent) : { success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE - Delete student
    if (method === 'DELETE') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const sanitizedId = sanitizeString(id, 50)
      
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', sanitizedId)
      
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ success: true, id: sanitizedId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
