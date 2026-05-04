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
  const rateLimitResult = await checkRateLimit(ip, 'ai')
  
  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
    }), { 
      status: 429, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
  
  try {
    const url = new URL(req.url)
    const method = req.method
    
    // POST - Process AI query
    if (method === 'POST') {
      let body: Record<string, unknown> = {}
      try { body = await req.json() } catch (_e) {}
      
      const message = String(body.message || '').trim()
      const role = String(body.role || 'guest')
      const context = body.context || {}
      
      if (!message) {
        return new Response(JSON.stringify({ error: 'Message is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Simple AI response based on keywords and role
      const response = await generateAIResponse(message, role, context, supabase)
      
      return new Response(JSON.stringify({ 
        message: response,
        timestamp: new Date().toISOString()
      }), {
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

// Helper function to generate AI responses
async function generateAIResponse(message: string, role: string, context: any, supabase: any): Promise<string> {
  const msgLower = message.toLowerCase()
  
  // Financial queries
  if (msgLower.includes('revenue') || msgLower.includes('income') || msgLower.includes('money')) {
    if (role === 'admin' || role === 'master') {
      return "Based on current data, the academy's revenue trends show steady growth. Would you like me to generate a detailed financial report?"
    }
    return "I can help you understand the academy's financial performance once you're logged in as an admin or master user."
  }
  
// Student queries region
   if (msgLower.includes('student') || msgLower.includes('enrollment') || msgLower.includes('admission')) {
     if (role === 'admin' || role === 'master') {
       return "Current enrollment shows active growth. I can provide detailed student analytics including demographics, payment status, and progress tracking."
     }
     if (role === 'parent') {
       return "For information about your child's progress, please check the 'My Child' section or ask specific questions about attendance, fees, or performance."
     }
     return "Student information is available to authorized users. Please log in to access enrollment and progress details."
   }

   // Coach queries region
   if (msgLower.includes('coach') || msgLower.includes('instructor') || msgLower.includes('teacher')) {
     if (role === 'admin' || role === 'master') {
       return "Coach performance metrics are available. I can help you analyze coach effectiveness, student distribution, and performance insights."
     }
     return "Coach information requires administrative access. Please log in as an admin or master user to view coach analytics."
   }

   // Event queries region
   if (msgLower.includes('event') || msgLower.includes('tournament') || msgLower.includes('competition') || msgLower.includes('workshop')) {
     return "Upcoming events and tournament information is available in the Events section. Would you like me to help you register for any specific events?"
   }

   // Attendance queries region
   if (msgLower.includes('attendance') || msgLower.includes('present') || msgLower.includes('absent')) {
     if (role === 'admin' || role === 'master') {
       return "Attendance tracking shows good participation rates. I can provide detailed attendance reports and trends."
     }
     if (role === 'parent') {
       return "Your child's attendance records are available in the My Child section under the Growth tab."
     }
     return "Attendance information requires login. Please sign in to view attendance records."
   }

   // Default response region
   if (role === 'admin' || role === 'master') {
     return "I'm your AI assistant for Chesskidoo Academy. I can help you with financial analytics, student insights, coach performance, and operational reports. What would you like to explore?"
   }

   if (role === 'parent') {
     return "Hello! I'm here to help you track your child's chess journey. You can ask about attendance, fee status, upcoming events, or your child's progress."
   }

   return "Welcome to Chesskidoo Academy AI Assistant! Please log in to access personalized insights and academy analytics."
  
  #region COACH QUERIES
  if (msgLower.includes('coach') || msgLower.includes('instructor') || msgLower.includes('teacher')) {
    if (role === 'admin' || role === 'master') {
      return "Coach performance metrics are available. I can help you analyze coach effectiveness, student distribution, and performance insights."
    }
    return "Coach information requires administrative access. Please log in as an admin or master user to view coach analytics."
  }
  
  #endregion
  
  #region EVENT QUERIES
  if (msgLower.includes('event') || msgLower.includes('tournament') || msgLower.includes('competition') || msgLower.includes('workshop')) {
    return "Upcoming events and tournament information is available in the Events section. Would you like me to help you register for any specific events?"
  }
  
  #endregion
  
  #region ATTENDANCE QUERIES
  if (msgLower.includes('attendance') || msgLower.includes('present') || msgLower.includes('absent')) {
    if (role === 'admin' || role === 'master') {
      return "Attendance tracking shows good participation rates. I can provide detailed attendance reports and trends."
    }
    if (role === 'parent') {
      return "Your child's attendance records are available in the My Child section under the Growth tab."
    }
    return "Attendance information requires login. Please sign in to view attendance records."
  }
  
  #endregion
  
  #region DEFAULT RESPONSE
  if (role === 'admin' || role === 'master') {
    return "I'm your AI assistant for Chesskidoo Academy. I can help you with financial analytics, student insights, coach performance, and operational reports. What would you like to explore?"
  }
  
  if (role === 'parent') {
    return "Hello! I'm here to help you track your child's chess journey. You can ask about attendance, fee status, upcoming events, or your child's progress."
  }
  
  return "Welcome to Chesskidoo Academy AI Assistant! Please log in to access personalized insights and academy analytics."
}
#endregion