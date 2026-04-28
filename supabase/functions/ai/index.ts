Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const message = body.message || '';
    const userRole = body.role || 'admin';
    const ctx = body.context || {};
    const studentsData = ctx.students ? `Academy has ${ctx.students} students, ${ctx.activeStudents || 0} active.` : '';
    const revenueData = ctx.revenue ? `Current revenue: ₹${ctx.revenue.toLocaleString()}` : '';
    const pendingData = ctx.pendingPayments ? `${ctx.pendingPayments} payments pending` : '';
    
    const API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    // Fallback if no key is set yet - use context data
    if (!API_KEY) {
      const lowerMessage = message.toLowerCase();
      let reply = `Hi! I'm the Chesskidoo AI Assistant. 📊 ${studentsData} ${revenueData}`;
      if (lowerMessage.includes('student') || lowerMessage.includes('enroll')) {
        reply = `You have ${ctx.students || 0} students. ${ctx.activeStudents || 0} are active. Add new students via the 'Enroll' button in the Students tab.`;
      } else if (lowerMessage.includes('payment') || lowerMessage.includes('fee') || lowerMessage.includes('due')) {
        reply = `You have ${ctx.pendingPayments || 0} pending payments. Check the Payments tab to see dues and mark cadets as paid.`;
      } else if (lowerMessage.includes('revenue') || lowerMessage.includes('income')) {
        reply = `Your monthly revenue is approximately ₹${(ctx.revenue || 0).toLocaleString()}. The Dashboard provides detailed revenue analysis.`;
      } else if (lowerMessage.includes('coach') || lowerMessage.includes('teacher')) {
        reply = `You have ${ctx.coaches || 0} coaches. Manage them in the Coach Management tab.`;
      } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('help')) {
        reply = `Hello! I can help with student info, payments, revenue, and coach management. ${studentsData} ${pendingData}. What would you like to know?`;
      }
      return new Response(JSON.stringify({ message: reply }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPromptAdmin = `You are the Chesskidoo Pro-Manager AI. You are a consultant for a premium chess academy. 
Expertise:
- Academy Operations: Billing cycles (Monthly/Quarterly), batch utilization, and profitability tracking.
- Coach Communication: Use the "Inform" feature in Coach Management or Dashboard to send pending fee lists to coaches via WhatsApp.
- Chess Pedagogy: FIDE Rating progression (800 -> 1200 -> 1800+), Opening repertoires, and Tournament strategy.
- Tiers: Beginner (U-800), Intermediate (800-1200), Advanced (1200-1600), Elite (1600+).
- Culture: Knowledge of Indian prodigies, major local tournaments, and parent communication styles.

Context Data:
- Academy Stats: ${ctx.students || '0'} students | ${ctx.activeStudents || 0} active | ${ctx.coaches || '0'} coaches | ₹${(ctx.revenue || 0).toLocaleString()} revenue
- Payments: ${ctx.pendingPayments || 0} pending
- Current Focus: ${ctx.moduleFocus || 'Dashboard'}
- AI State: Real-time data from Academy DB.

Objectives:
- Provide high-level business strategy. 
- Suggest marketing angles based on academy growth.
- Help optimize coach-to-student ratios.
Be authoritative yet professional and supportive.`;

    const systemPromptParent = `You are the Chesskidoo Success Guide for Parents. Your goal is to help parents support their child's chess ambition.
Knowledge:
- ELO Progression: Explain why ratings fluctuate and how to handle losses.
- Tournament Readiness: Checklists for a child's first tournament.
- Balanced Learning: Benefits of chess for concentration, math, and psychology.

Context:
- Student: ${body.context?.childName || 'Your Cadet'}
- Level: ${body.context?.level || 'Beginner'} | Rating: ${body.context?.rating || '800'}
- Progress: ${body.context?.recentStats || 'Steady growth'}

Tone: Encouraging, educational, and empathetic to the "chess parent" journey.`;
    
    const systemInstruction = userRole === 'parent' ? systemPromptParent : systemPromptAdmin;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 250 }
      })
    });

    const data = await res.json();
    let reply = "I'm having trouble thinking right now.";
    
    if (!res.ok) {
      reply = `API Error: ${data.error?.message || res.statusText}`;
    } else if (data.candidates && data.candidates.length > 0) {
      reply = data.candidates[0].content.parts[0].text;
    }

    return new Response(JSON.stringify({ message: reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, message: 'AI Assistant encountered an error.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});