import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { method } = req;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };

  if (method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { image, filename } = await req.json().catch(() => ({}));
    if (!image) throw new Error('No image data provided');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') || '';
    const IMGBB_API_KEY = Deno.env.get('IMGBB_API_KEY') || '';

    // Try IMGBB first if configured
    if (IMGBB_API_KEY) {
      try {
        const params = new URLSearchParams();
        params.append('image', image);

        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: 'POST',
          body: params
        });

        const data = await res.json();
        if (data.success && data.data?.url) {
          return new Response(JSON.stringify({
            success: true,
            data: { url: data.data.url }
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        throw new Error('IMGBB upload failed');
      } catch (e) {
        console.warn('[Upload] IMGBB failed, falling back to Supabase Storage:', e.message);
      }
    }

    // Fallback: Supabase Storage
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Upload service not configured. Set IMGBB_API_KEY or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Decode base64 and determine file extension
    const base64Data = image.replace(/^data:[^;]+;base64,/, '');
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const ext = (filename && filename.includes('.')) ? filename.split('.').pop() : 'bin';
    // Map file extensions to proper MIME types
    const mimeTypes = {
      pdf: 'pdf', doc: 'msword', docx: 'vnd.openxmlformats-officedocument.wordprocessingml.document',
      pgn: 'x-chess-pgn', txt: 'plain', md: 'markdown',
      png: 'png', jpg: 'jpeg', jpeg: 'jpeg', gif: 'gif', ppt: 'vnd.ms-powerpoint', pptx: 'vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    const mimeType = mimeTypes[ext.toLowerCase()] || ext;
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('homework-files')
      .upload(filePath, bytes, {
        contentType: `application/${mimeType}`,
        upsert: true
      });

    if (uploadError) {
      console.error('[Upload] Supabase Storage error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('homework-files')
      .getPublicUrl(filePath);

    return new Response(JSON.stringify({
      success: true,
      data: {
        url: urlData.publicUrl,
        filename: filename || filePath
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Upload] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Upload failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});