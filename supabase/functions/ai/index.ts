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
  const baseIdentity = `You are **TOM AI** (Training Operations Manager), the highly intelligent AI command center for Chesskidoo Chess Academy.

CRITICAL INTEL CORE:
1. **Academy/Operational Mode**: For any queries related to students, attendance, schedules, payments, finances, or academy operations, you MUST strictly rely on the LIVE ACADEMY DATA provided. NEVER make up figures, ELO ratings, payment details, or names. If specific data is missing from context, state that honestly.
2. **General Chess / Conversation Mode**: If the user asks about chess rules, general opening strategies (e.g. Sicilian Defense, Ruy Lopez), general chess history, greetings, or non-academy general knowledge, you are fully authorized to use your internal trained AI database to provide a detailed, engaging, and accurate answer rather than refusing the query.
3. Use rich markdown: **bold** for emphasis, bullet points for lists, and clean tables for data comparison.
4. Be structured, professional, and clear.
5. Current date/time: ${new Date().toISOString()}
`

  const roleContext = role === 'parent' 
    ? `\nCRITICAL PARENT PORTAL SAFEGUARDS & RESTRICTIONS:
- You are speaking to a PARENT/STUDENT. You must ONLY discuss or show data belonging to their specific child.
- STRICTLY FORBIDDEN: NEVER reveal or discuss academy-wide financials, monthly revenues, total profits, expenses, other students' names, other students' ratings/progress, other parents' details, coach salaries, or any internal admin reports.
- If the user asks about any of these forbidden topics, politely refuse, explaining that for privacy and security, you can only discuss their own child's data and general chess concepts.
- Focus the conversation on their child's progress, attendance, billing, and learning tips.`
    : `\nYou are speaking with an ADMIN/MASTER. You have full access to all academy data. Be strategic, executive, and direct in your analysis.`

  const moduleInstructions: Record<string, string> = {
    'global': `\nMODULE: Global Academy Insights\nFocus: Overall academy health, enrollment trends, key metrics, strategic recommendations. Provide executive-level summaries.`,
    'finance': `\nMODULE: Financial Analysis\nFocus: Revenue tracking, payment collections, outstanding dues, coach salary costs, profitability analysis, MoM growth. Format reports as tables and provide actionable ROI summaries.`,
    'coach': `\nMODULE: Coach Performance\nFocus: Individual coach metrics, student load distribution, teaching effectiveness, salary efficiency, schedule optimization. Present comparison tables.`,
    'student-intel': `\nMODULE: Student Intelligence\nFocus: Individual student progress analysis, weak students needing attention, promotion candidates, attendance risk scoring, personalized training recommendations, ELO progression tracking. Print lists in clean tables with name, rating, level, coach, and recommendation.`,
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
  
  // Extract lists from enriched client context
  const students = ctx.students_list || []
  const coaches = ctx.coaches_list || []
  
  const activeStudents = students.filter((s: any) => s.status === 'active')
  const totalStudentsCount = activeStudents.length || ctx.activeStudents || 0
  const totalCoachesCount = coaches.length || ctx.coaches || 0
  const revenue = ctx.revenue || activeStudents.reduce((acc: number, s: any) => acc + (s.fee || 0), 0)
  
  const paidCount = activeStudents.filter((s: any) => s.payment_status === 'Paid').length
  const unpaidCount = activeStudents.filter((s: any) => s.payment_status === 'Due' || s.payment_status === 'Overdue').length
  const computedCollectionRate = totalStudentsCount > 0 ? ((paidCount / totalStudentsCount) * 100).toFixed(1) : '100.0'

  // Weak students analysis
  if (msgLower.includes('weak') || msgLower.includes('struggling') || msgLower.includes('attention') || msgLower.includes('risk')) {
    const weak = activeStudents.filter((s: any) => (s.rating || 800) < 1000)
    if (weak.length === 0) {
      return `🎯 **TOM Analysis: No At-Risk Students**\n\nAll ${totalStudentsCount} enrolled students are currently rated above 1000 ELO. The academy is performing well across the board.\n\n💡 **Recommendation:** Focus on advancing intermediate students (1000-1200) to the next level with targeted tactical training.`
    }
    let resp = `⚠️ **TOM Student Risk Report**\n\n**${weak.length} student(s)** require immediate attention (below 1000 ELO):\n\n`
    resp += `| Student | Rating (ELO) | Level | Coach | Attendance Rate |\n| :--- | :--- | :--- | :--- | :--- |\n`
    weak.slice(0, 15).forEach((s: any) => {
      resp += `| **${s.name}** | ${s.rating} | ${s.level} | ${s.coach_name} | ${s.attendance_rate}% |\n`
    })
    resp += `\n💡 **TOM Recommendations:**\n• Assign extra tactical puzzle sessions\n• Schedule 1-on-1 review with coach\n• Consider batch adjustment for personalized attention`
    return resp
  }

  // Tournament readiness
  if (msgLower.includes('tournament') || msgLower.includes('competition') || msgLower.includes('ready')) {
    const ready = activeStudents.filter((s: any) => (s.rating || 0) >= 1000)
    if (ready.length === 0) {
      return `🏆 **TOM Tournament Readiness Report**\n\nCurrently, no active students meet the minimum tournament criteria of 1000+ ELO.\n\n💡 **Recommendation:** Focus on intensive training for students close to the threshold.`
    }
    let resp = `🏆 **TOM Tournament Readiness Report**\n\n**${ready.length}/${totalStudentsCount}** active students meet minimum tournament criteria (1000+ ELO):\n\n`
    resp += `| Student | Rating (ELO) | Level | Coach | Readiness Status |\n| :--- | :--- | :--- | :--- | :--- |\n`
    ready.slice(0, 15).forEach((s: any) => {
      const readiness = (s.rating || 0) >= 1400 ? '🟢 High' : (s.rating || 0) >= 1200 ? '🟡 Medium' : '🔵 Developing'
      resp += `| **${s.name}** | ${s.rating} | ${s.level} | ${s.coach_name} | ${readiness} |\n`
    })
    return resp
  }

  // Coach analysis
  if (msgLower.includes('coach') || msgLower.includes('instructor') || msgLower.includes('top coach') || msgLower.includes('best coach') || msgLower.includes('salary') || msgLower.includes('roi')) {
    if (coaches.length === 0) {
      return `🧑🏫 **TOM Coach Report**\n\nCoach data is being synchronized. Please try again in a moment.`
    }
    let resp = `🧑🏫 **TOM Coach Performance & ROI Report**\n\nHere is the financial and operational analysis for all **${totalCoachesCount} active coaches**:\n\n`
    resp += `| Coach | Specialty | Students | Collected Revenue | Salary Cost | Net Profit | ROI |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`
    coaches.forEach((c: any) => {
      resp += `| **${c.name}** | ${c.specialty} | ${c.studentCount} | ₹${c.collected_revenue?.toLocaleString()} | ₹${c.salary_cost?.toLocaleString()} | ₹${c.net_profit?.toLocaleString()} | ${c.roi} |\n`
    })
    resp += `\n💡 **TOM Recommendation:** Check coach student loads to ensure a balanced teaching distribution (target: 5-8 students per coach).`
    return resp
  }

  // Revenue/Financial
  if (msgLower.includes('revenue') || msgLower.includes('money') || msgLower.includes('payment') || msgLower.includes('finance') || msgLower.includes('due') || msgLower.includes('arrears') || msgLower.includes('profit')) {
    if (role !== 'admin' && role !== 'master') {
      return `🔒 Financial data is restricted to administrators. Please contact the academy admin for financial inquiries.`
    }
    const unpaidStudents = activeStudents.filter((s: any) => s.payment_status === 'Due' || s.payment_status === 'Overdue')
    let resp = `💰 **TOM Financial Intelligence Report**\n\n`
    resp += `• **Projected Revenue:** ₹${Number(revenue).toLocaleString()}\n`
    resp += `• **Collection Rate:** ${computedCollectionRate}%\n`
    resp += `• **Pending Payments:** ${unpaidCount} student(s)\n`
    resp += `• **Active Students:** ${totalStudentsCount}\n`
    resp += `• **Active Coaches:** ${totalCoachesCount}\n\n`
    
    if (unpaidStudents.length > 0) {
      resp += `⚠️ **Students with Outstanding Dues:**\n`
      resp += `| Student | Rating (ELO) | Level | Coach | Monthly Fee | Status |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n`
      unpaidStudents.slice(0, 10).forEach((s: any) => {
        resp += `| **${s.name}** | ${s.rating} | ${s.level} | ${s.coach_name} | ₹${s.fee?.toLocaleString()} | **${s.payment_status}** |\n`
      })
    }
    
    resp += `\n💡 **TOM Recommendation:** ${Number(computedCollectionRate) < 80 ? 'Collection rate is below target. Consider sending automated payment reminders to overdue accounts.' : 'Collection rate is healthy. Maintain current follow-up cadence.'}`
    return resp
  }

  // Student count / enrollment
  if (msgLower.includes('student') || msgLower.includes('how many') || msgLower.includes('enrolled') || msgLower.includes('count')) {
    let resp = `📊 **TOM Academy Census Report**\n\n`
    resp += `• **Active Enrolled Students:** ${totalStudentsCount}\n`
    resp += `• **Active Teaching Coaches:** ${totalCoachesCount}\n`
    resp += `• **Overall Collection Rate:** ${computedCollectionRate}%\n`
    resp += `• **Pending Payment Cases:** ${unpaidCount}\n\n`
    resp += `💡 Ask me about specific students, weak performers, or tournament readiness for deeper analysis.`
    return resp
  }

  // Health / Summary
  if (msgLower.includes('health') || msgLower.includes('summary') || msgLower.includes('overview') || msgLower.includes('audit') || msgLower.includes('report')) {
    return `🏫 **TOM Academy Health Report**\n\n✅ **Student Base:** ${totalStudentsCount} active enrolled\n✅ **Coaching Team:** ${totalCoachesCount} active coaches\n💰 **Revenue Collected:** ${computedCollectionRate}% collected (Projected: ₹${Number(revenue).toLocaleString()})\n⚠️ **Dues Outstanding:** ${unpaidCount} student(s)\n\n💡 **Overall Status:** ${Number(computedCollectionRate) >= 85 ? '🟢 Excellent' : Number(computedCollectionRate) >= 70 ? '🟡 Good — improve collections' : '🔴 Needs Attention — collections below target'}`
  }

  // Attendance
  if (msgLower.includes('attendance') || msgLower.includes('absent') || msgLower.includes('present')) {
    const lowAttendance = activeStudents.filter((s: any) => s.attendance_rate < 75)
    let resp = `📅 **TOM Attendance Intelligence Report**\n\n`
    resp += `Academy-wide attendance logs analyzed. Current summary:\n`
    resp += `• **Active Students:** ${totalStudentsCount}\n`
    resp += `• **Low Attendance Alerts (<75%):** ${lowAttendance.length} student(s)\n\n`
    
    if (lowAttendance.length > 0) {
      resp += `⚠️ **Students at Attendance Risk:**\n`
      resp += `| Student | ELO | Attendance % | Coach | Payment Status |\n| :--- | :--- | :--- | :--- | :--- |\n`
      lowAttendance.slice(0, 10).forEach((s: any) => {
        resp += `| **${s.name}** | ${s.rating} | ${s.attendance_rate}% | ${s.coach_name} | ${s.payment_status} |\n`
      })
    }
    
    resp += `\n💡 **TOM Insight:** Low attendance is often correlated with outstanding dues or declining interest. Suggest calling parent for follow-up.`
    return resp
  }

  // Default
  if (role === 'admin' || role === 'master') {
    return `🤖 **TOM AI — Training Operations Manager**\n\nI'm connected to your live academy database with ${totalStudentsCount} active students and ${totalCoachesCount} coaches.\n\n**Try asking me:**\n• "Who are the weak students?"\n• "Show tournament readiness"\n• "Academy health report"\n• "Financial summary"\n• "Coach performance comparison"\n• "Which students need attention?"\n\nI provide precise answers using your real-time data.`
  }

  if (role === 'parent') {
    return `🤖 **TOM AI — Parent Portal**\n\nI can help you track your child's chess journey. Ask me about:\n• Progress & ELO rating\n• Attendance records\n• Upcoming events\n• Payment status\n• Coach feedback`
  }

  return `🤖 **Welcome to TOM AI** — the Training Operations Manager for Chesskidoo Academy.\n\nPlease sign in to access personalized insights and real-time analytics.`
}