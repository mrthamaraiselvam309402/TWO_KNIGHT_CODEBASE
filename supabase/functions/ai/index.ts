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
    const studentsData = body.context?.students ? `Academy has ${body.context.students} students.` : '';
    
    const API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    // Fallback if no key is set yet
    if (!API_KEY) {
      const lowerMessage = message.toLowerCase();
      let reply = "Hi! I am the Chesskidoo AI Assistant. (Note: Gemini API key is currently missing, so I am running in offline mode).";
      if (lowerMessage.includes('student') || lowerMessage.includes('enroll')) {
        reply = "You can add new students using the 'Enroll' option in the Students tab.";
      } else if (lowerMessage.includes('payment') || lowerMessage.includes('fee')) {
        reply = "Check the Payments tab to see outstanding dues and mark cadets as paid.";
      } else if (lowerMessage.includes('revenue')) {
        reply = "I don't have the exact numbers, but your Dashboard provides a full Revenue Analysis.";
      }
      return new Response(JSON.stringify({ message: reply }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPromptAdmin = `You are the Chesskidoo Pro-Manager AI. You are a consultant for a premium chess academy. 
Expertise:
- Academy Operations: Billing cycles (Monthly/Quarterly), batch utilization, and profitability tracking.
- Chess Pedagogy: FIDE Rating progression (800 -> 1200 -> 1800+), Opening repertoires, and Tournament strategy.
- Tiers: Beginner (U-800), Intermediate (800-1200), Advanced (1200-1600), Elite (1600+).
- Culture: Knowledge of Indian prodigies, major local tournaments, and parent communication styles.

Context Data:
- Academy Stats: ${body.context?.students || '0'} students | ${body.context?.coaches || '0'} coaches | ₹${body.context?.revenue || '0'} revenue
- Current Focus: ${body.context?.moduleFocus || 'Dashboard'}
- AI State: RAG-Augmented retrieval from Academy DB.

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