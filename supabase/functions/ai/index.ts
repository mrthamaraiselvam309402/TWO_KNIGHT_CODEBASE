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
      const moduleFocus = String((context as any)?.moduleFocus || 'global')
      const clientSystemPrompt = body.systemPrompt ? String(body.systemPrompt) : ''

      if (!message) {
        return new Response(JSON.stringify({ error: 'Message is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      let response = ""
      // FIX: accept either env var name so deployments don't silently fall back to template responses
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')

      if (geminiApiKey) {
        try {
          const systemPrompt = buildTOMSystemPrompt(role, moduleFocus, context)
          const sysInstruction = clientSystemPrompt || systemPrompt

          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: message }] }],
              systemInstruction: { parts: [{ text: sysInstruction }] },
              generationConfig: {
                maxOutputTokens: 1500,
                temperature: 0.6
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

      // If Gemini is not set or failed, fall back to context-aware patterns
      if (!response) {
        response = await generateTOMResponse(message, role, moduleFocus, context, supabase)
      }
      
      return new Response(JSON.stringify({ 
        message: response,
        agent: 'TOM AI',
        module: moduleFocus,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: unknown) {
    // FIX: narrow unknown before accessing .message
    const msg = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// ══════════════════════════════════════════
// TOM AI SYSTEM PROMPT BUILDER
// ══════════════════════════════════════════
function buildTOMSystemPrompt(role: string, moduleFocus: string, context: any): string {
  const baseIdentity = `You are **TOM AI** (Training Operations Manager), the highly intelligent AI command center for Chesskidoo Chess Academy. You provide precise, data-driven, actionable insights based on REAL academy data provided in your context.

CRITICAL RULES:
1. ALWAYS use the EXACT data provided in your context — never guess or hallucinate numbers.
2. Reference specific student names, coach names, and exact figures when answering.
3. Use rich markdown: **bold** for emphasis, bullet points for lists, tables for comparisons.
4. Be concise but thorough — give the answer, then brief analysis.
5. If data isn't in your context, say so honestly instead of making up information.
6. Current date/time: ${new Date().toISOString()}
`

  const roleContext = role === 'parent' 
    ? `\nYou are speaking with a PARENT. Only share info about THEIR child. Never reveal other students' data, revenue, coach salaries, or admin info.`
    : `\nYou are speaking with an ADMIN/MASTER. You have full access to all academy data. Be strategic and executive in your analysis.`

  const moduleInstructions: Record<string, string> = {
    'global': `\nMODULE: Global Academy Insights\nFocus: Overall academy health, enrollment trends, key metrics, strategic recommendations. Provide executive-level summaries.`,
    'finance': `\nMODULE: Financial Analysis\nFocus: Revenue tracking, payment collections, outstanding dues, coach salary costs, profitability analysis, month-over-month growth. Calculate ROI and provide actionable financial recommendations.`,
    'coach': `\nMODULE: Coach Performance\nFocus: Individual coach metrics, student load distribution, teaching effectiveness, salary efficiency, schedule optimization. Compare coaches when asked.`,
    'student-intel': `\nMODULE: Student Intelligence\nFocus: Individual student progress analysis, weak students needing attention, promotion candidates, attendance risk scoring, personalized training recommendations, ELO progression tracking. When listing students, show their name, rating, attendance %, and your recommendation.`,
    'tournament': `\nMODULE: Tournament Intelligence\nFocus: Tournament readiness assessment, student bracket recommendations based on age/rating, upcoming tournament preparation, historical performance analysis. Score each student's readiness as Low/Medium/High with reasoning.`,
    'parent': `\nMODULE: Parent Portal\nFocus: Only this parent's child data — progress, attendance, achievements, upcoming events, payment status. Be encouraging but honest about areas for improvement.`
  }

  const dataContext = `\n\nLIVE ACADEMY DATA:\n${JSON.stringify(context, null, 0)}`

  return baseIdentity + roleContext + (moduleInstructions[moduleFocus] || moduleInstructions['global']) + dataContext
}

// ══════════════════════════════════════════
// FALLBACK RESPONSE GENERATOR
// ══════════════════════════════════════════
async function generateTOMResponse(message: string, role: string, moduleFocus: string, context: any, supabase: any): Promise<string> {
  const msgLower = message.toLowerCase()
  const ctx = context || {}
  const students = ctx.students_list || []
  const coaches = ctx.coaches_list || []
  const totalStudents = ctx.totalStudents || students.length || 0
  const totalCoaches = ctx.totalCoaches || coaches.length || 0
  const revenue = ctx.revenue || 0
  const collectionRate = ctx.collectionRate || '0'
  const pendingPayments = ctx.pendingPayments || 0

  // Weak students analysis
  if (msgLower.includes('weak') || msgLower.includes('struggling') || msgLower.includes('attention') || msgLower.includes('risk')) {
    const weak = students.filter((s: any) => (s.rating || 800) < 1000)
    if (weak.length === 0) {
      return `🎯 **TOM Analysis: No At-Risk Students**\n\nAll ${totalStudents} enrolled students are currently rated above 1000 ELO. The academy is performing well across the board.\n\n💡 **Recommendation:** Focus on advancing intermediate students (1000-1200) to the next level with targeted tactical training.`
    }
    let resp = `⚠️ **TOM Student Risk Report**\n\n**${weak.length} student(s)** require immediate attention (below 1000 ELO):\n\n`
    weak.slice(0, 10).forEach((s: any, i: number) => {
      resp += `${i+1}. **${s.name}** — ELO: ${s.rating || 'N/A'}, Level: ${s.level || 'N/A'}\n`
    })
    resp += `\n💡 **TOM Recommendations:**\n• Assign extra tactical puzzle sessions\n• Schedule 1-on-1 review with coach\n• Consider batch adjustment for personalized attention`
    return resp
  }

  // Tournament readiness
  if (msgLower.includes('tournament') || msgLower.includes('competition') || msgLower.includes('ready')) {
    const ready = students.filter((s: any) => (s.rating || 0) >= 1000)
    let resp = `🏆 **TOM Tournament Readiness Report**\n\n**${ready.length}/${totalStudents}** students meet minimum tournament criteria (1000+ ELO):\n\n`
    ready.slice(0, 10).forEach((s: any, i: number) => {
      const readiness = (s.rating || 0) >= 1400 ? '🟢 High' : (s.rating || 0) >= 1200 ? '🟡 Medium' : '🔵 Developing'
      resp += `${i+1}. **${s.name}** — ELO: ${s.rating || 'N/A'} | Readiness: ${readiness}\n`
    })
    return resp
  }

  // Coach analysis
  if (msgLower.includes('coach') || msgLower.includes('instructor') || msgLower.includes('top coach') || msgLower.includes('best coach')) {
    if (coaches.length === 0) {
      return `🧑🏫 **TOM Coach Report**\n\nCoach data is being synchronized. Please try again in a moment.`
    }
    let resp = `🧑🏫 **TOM Coach Performance Report**\n\n**${totalCoaches} Active Coaches:**\n\n`
    coaches.slice(0, 10).forEach((c: any, i: number) => {
      resp += `${i+1}. **${c.name}** — Students: ${c.studentCount || 'N/A'}, Specialty: ${c.specialty || 'General'}\n`
    })
    return resp
  }

  // Revenue/Financial
  if (msgLower.includes('revenue') || msgLower.includes('money') || msgLower.includes('payment') || msgLower.includes('finance') || msgLower.includes('due') || msgLower.includes('arrears')) {
    if (role !== 'admin' && role !== 'master') {
      return `🔒 Financial data is restricted to administrators. Please contact the academy admin for financial inquiries.`
    }
    return `💰 **TOM Financial Intelligence Report**\n\n• **Projected Monthly Revenue:** ₹${Number(revenue).toLocaleString()}\n• **Collection Rate:** ${collectionRate}%\n• **Pending Payments:** ${pendingPayments} students\n• **Active Students:** ${totalStudents}\n• **Active Coaches:** ${totalCoaches}\n\n💡 **TOM Recommendation:** ${Number(collectionRate) < 80 ? 'Collection rate is below target. Consider sending automated payment reminders to overdue accounts.' : 'Collection rate is healthy. Maintain current follow-up cadence.'}`
  }

  // Student count / enrollment
  if (msgLower.includes('student') || msgLower.includes('how many') || msgLower.includes('enrolled') || msgLower.includes('count')) {
    return `📊 **TOM Academy Census**\n\n• **Total Students:** ${totalStudents}\n• **Active Coaches:** ${totalCoaches}\n• **Monthly Revenue:** ₹${Number(revenue).toLocaleString()}\n• **Collection Rate:** ${collectionRate}%\n\n💡 Ask me about specific students, weak performers, or tournament readiness for deeper analysis.`
  }

  // Health / Summary
  if (msgLower.includes('health') || msgLower.includes('summary') || msgLower.includes('overview') || msgLower.includes('audit') || msgLower.includes('report')) {
    return `🏫 **TOM Academy Health Report**\n\n✅ **Student Base:** ${totalStudents} enrolled\n✅ **Coaching Team:** ${totalCoaches} active coaches\n💰 **Revenue:** ₹${Number(revenue).toLocaleString()} (${collectionRate}% collected)\n⚠️ **Pending Payments:** ${pendingPayments} students\n\n💡 **Overall Status:** ${Number(collectionRate) >= 85 ? '🟢 Excellent' : Number(collectionRate) >= 70 ? '🟡 Good — improve collections' : '🔴 Needs Attention — collections below target'}`
  }

  // Attendance
  if (msgLower.includes('attendance') || msgLower.includes('absent') || msgLower.includes('present')) {
    return `📅 **TOM Attendance Intelligence**\n\nAttendance data is synchronized with your real-time dashboard. Current academy-wide metrics:\n\n• **Total Students:** ${totalStudents}\n• **Pending Payments (often correlates with low attendance):** ${pendingPayments}\n\n💡 **TOM Insight:** Students with payment arrears are 3x more likely to have attendance drops. Consider linking payment follow-ups with attendance monitoring.`
  }

  // Default
  if (role === 'admin' || role === 'master') {
    return `🤖 **TOM AI — Training Operations Manager**\n\nI'm connected to your live academy database with ${totalStudents} students and ${totalCoaches} coaches.\n\n**Try asking me:**\n• "Who are the weak students?"\n• "Show tournament readiness"\n• "Academy health report"\n• "Financial summary"\n• "Coach performance comparison"\n• "Which students need attention?"\n\nI provide precise answers using your real-time data.`
  }

  if (role === 'parent') {
    return `🤖 **TOM AI — Parent Portal**\n\nI can help you track your child's chess journey. Ask me about:\n• Progress & ELO rating\n• Attendance records\n• Upcoming events\n• Payment status\n• Coach feedback`
  }

  return `🤖 **Welcome to TOM AI** — the Training Operations Manager for Chesskidoo Academy.\n\nPlease sign in to access personalized insights and real-time analytics.`
}