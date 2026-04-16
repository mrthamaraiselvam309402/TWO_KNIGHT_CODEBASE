Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Simple AI responses for chess academy
    const responses: Record<string, string> = {
      'hello': 'Hello! I am Chesskidoo AI Assistant. I can help you with student management, chess training, and academy operations.',
      'help': 'I can help you with: adding students, viewing achievements, scheduling events, processing payments, and chess analysis.',
      'student': 'To add a student, go to the Students tab and click Add Student. Fill in their name, age, and parent contact info.',
      'payment': 'To record a payment, find the student in the list and click Mark Paid, or use the Payments tab.',
      'achievement': 'To add an achievement, go to Achievements and click Add Achievement. Include the student name and award details.',
    };

    const { message } = await req.json().catch(() => ({ message: '' }));
    
    const lowerMessage = message?.toLowerCase() || '';
    let reply = responses['help'];
    
    for (const [key, value] of Object.entries(responses)) {
      if (lowerMessage.includes(key)) {
        reply = value;
        break;
      }
    }

    return new Response(JSON.stringify({ 
      message: reply,
      action: action 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, message: 'AI Assistant ready' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});