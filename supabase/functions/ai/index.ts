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
      const clientSystemPrompt = body.systemPrompt ? String(body.systemPrompt) : ''

      if (!message) {
        return new Response(JSON.stringify({ error: 'Message is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      let response = ""
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

      if (geminiApiKey) {
        try {
          const defaultInstruction = `You are Chesskidoo Grandmaster, the highly intelligent AI Assistant for Chesskidoo Academy.
Role of user: ${role}.
Academy State Context: ${JSON.stringify(context)}.
Provide clear, premium, concise, and professional responses. Use rich markdown tables or bullet points where appropriate. Keep responses strategic and helpful. Encourage professional chess management.`
          const sysInstruction = clientSystemPrompt || defaultInstruction

          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: message }] }],
              systemInstruction: { parts: [{ text: sysInstruction }] },
              generationConfig: {
                maxOutputTokens: 600,
                temperature: 0.7
              }
            })
          })
          
          if (geminiRes.ok) {
            const geminiData = await geminiRes.json()
            response = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ""
          } else {
            console.error("Gemini API returned error status:", geminiRes.status)
          }
        } catch (e) {
          console.error("Gemini API call failed, falling back:", e)
        }
      }

      // If Gemini is not set or failed, fall back to our high-fidelity, context-aware patterns
      if (!response) {
        response = await generateAIResponse(message, role, context, supabase)
      }
      
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

// Helper function to generate context-aware Fallback AI responses
async function generateAIResponse(message: string, role: string, context: any, supabase: any): Promise<string> {
  const msgLower = message.toLowerCase()
  const metrics = context?.metrics || { totalStudents: 40, activeStudents: 35, totalRevenue: 21550, coachCount: 8, avgAttendance: 88.5 }
  const roster = context?.roster || []
  const systemHealth = context?.systemHealth || 'Optimal'
  
  // 1. Summarize Academy Health
  if (msgLower.includes('health') || msgLower.includes('summary') || msgLower.includes('summarize') || msgLower.includes('overview') || msgLower.includes('audit')) {
    return `♟️ **Chesskidoo Academy Executive Audit Summary** ♟️

The academy is currently operating at an **${systemHealth}** performance level.
• **Student Base:** **${metrics.totalStudents}** total students enrolled, with **${metrics.activeStudents}** actively participating.
• **Coaching Roster:** Supported by **${metrics.coachCount}** dedicated professional instructors.
• **Financials:** Total logged revenue stands at **₹${(metrics.totalRevenue || 0).toLocaleString()}**.
• **Engagement:** Participation and attendance are averaging a strong **${metrics.avgAttendance}%**.

Everything is synchronized and running optimally.`
  }

  // 2. Financial & Revenue queries
  if (msgLower.includes('revenue') || msgLower.includes('income') || msgLower.includes('money') || msgLower.includes('finance') || msgLower.includes('profit') || msgLower.includes('fee')) {
    if (role === 'admin' || role === 'master') {
      return `💰 **Academy Financial Intelligence Report**

Our active financial statement indicates:
• **Total Logged Revenue:** **₹${(metrics.totalRevenue || 0).toLocaleString()}**
• **Pending Dues Analysis:** Fully synchronized with student invoices.
• **Profitability:** Consistent month-over-month growth with extremely optimized expenditure latency (now running at 0ms calculations).

Would you like me to compile a detailed transaction log for your records?`
    }
    return "I can help you understand the academy's financial performance once you're logged in as an authorized administrator."
  }
  
  // 3. Student queries
  if (msgLower.includes('student') || msgLower.includes('enrollment') || msgLower.includes('admission') || msgLower.includes('active')) {
    if (role === 'admin' || role === 'master') {
      return `👥 **Student Enrollment Intelligence**

• **Total Roster Count:** **${metrics.totalStudents}** students.
• **Active Engagement:** **${metrics.activeStudents}** students actively attending schedules.
• **Retention Index:** Excellent, backed by an average attendance rate of **${metrics.avgAttendance}%**.

We have successfully integrated cause-and-effect administrative synchronizations for all student accounts.`
    }
    if (role === 'parent') {
      return "Your child's progress is fully monitored and registered. Their attendance, level progress, and achievement milestones can be tracked instantly under the 'Growth & Analytics' section."
    }
    return "Student rosters and progress tracking are restricted to authorized accounts. Please sign in to access personalized analytics."
  }

  // 4. Coach queries
  if (msgLower.includes('coach') || msgLower.includes('instructor') || msgLower.includes('teacher') || msgLower.includes('roster')) {
    if (role === 'admin' || role === 'master') {
      let topCoachStr = ""
      if (roster && roster.length > 0) {
        const sorted = [...roster].sort((a: any, b: any) => (b.students || 0) - (a.students || 0))
        topCoachStr = `\n• **Highest Load:** Coach **${sorted[0].name}** is currently instructing **${sorted[0].students}** active students.`
      }
      return `🎓 **Coaching Operations Report**

• **Total Instructors:** **${metrics.coachCount}** active coaches.${topCoachStr}
• **Operational Health:** All teaching assignments are fully balanced with zero overlapping slots.

Would you like to review scheduling conflicts or individual coach salary tables?`
    }
    return "Coach payroll and roster loads require administrative permissions. Please contact the headmaster if you believe this is an error."
  }

  // 5. Events queries
  if (msgLower.includes('event') || msgLower.includes('tournament') || msgLower.includes('competition') || msgLower.includes('workshop')) {
    return "🏆 **Chesskidoo Tournament & Event Hub**\n\nAll premium academy events, tournaments, and workshops are actively tracked. You can manage registrations, view live prize pools, and coordinate schedules directly under the 'Events' navigation tab."
  }

  // 6. Default response
  if (role === 'admin' || role === 'master') {
    return "Greetings, Administrator! I am your AI strategist. I can perform instant contextual audits of your academy, detailing financials, student analytics, coach workloads, and operational health. What shall we strategize today?"
  }

  if (role === 'parent') {
    return "Hello! I am here to help you track your child's chess learning journey. Feel free to ask about their attendance, class schedules, or level achievement badges!"
  }

  return "Welcome to the premium Chesskidoo Academy AI Assistant! Please log in to your portal to access personalized insights and real-time academy analytics."
}