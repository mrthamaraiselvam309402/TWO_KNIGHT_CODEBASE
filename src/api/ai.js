export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  // Simple AI response - in production, integrate with OpenAI
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const message = body.message || '';
    
    // Simple responses for now
    const responses = {
      'hello': 'Hello! I am Chesskidoo AI Assistant. How can I help you today?',
      'help': 'I can help you with: student management, coach scheduling, payments, and chess training.',
      'default': 'Thank you for your message! Our team will get back to you soon.'
    };
    
    const lowerMsg = message.toLowerCase();
    let response = responses.default;
    
    for (const key in responses) {
      if (lowerMsg.includes(key)) {
        response = responses[key];
        break;
      }
    }
    
    return res.status(200).json({ 
      message: response,
      original: message
    });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}