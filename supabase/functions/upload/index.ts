Deno.serve(async (req) => {
  const { method } = req;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };

  if (method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image) throw new Error('No image data provided');

    const IMGBB_API_KEY = Deno.env.get('IMGBB_API_KEY');
    if (!IMGBB_API_KEY) throw new Error('Server key configuration missing');

    // Forward to IMGBB
    const params = new URLSearchParams();
    params.append('image', image);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: params
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
