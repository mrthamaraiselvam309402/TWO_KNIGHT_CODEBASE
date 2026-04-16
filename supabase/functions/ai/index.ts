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

    const systemPromptAdmin = `You are the Chesskidoo AI Admin Assistant. You help managers run a premium chess academy. Be concise, professional, and data-driven.
Context Data:
- Total Enrolled Students: ${body.context?.students || 'Unknown'}
- Total Active Coaches: ${body.context?.coaches || 'Unknown'}
- Current Dashboard Focus: ${body.context?.moduleFocus?.toUpperCase() || 'GLOBAL'}

Guide the admin through revenue trends, coach utilization, and student growth. Provide actionable business insights.`;

    const systemPromptParent = `You are the Chesskidoo Success Assistant for Parents. You help parents track their child's chess journey.
Context Data:
- Child Name: ${body.context?.childName || 'Your Child'}
- Current Rating: ${body.context?.rating || '800'}
- Enrolled Events: ${body.context?.eventsCount || '0'}

Encourage parents, explain rating improvements, give advice on tournament preparation, and remind them of upcoming academy dates. Be friendly, child-focused, and supportive.`;
    
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