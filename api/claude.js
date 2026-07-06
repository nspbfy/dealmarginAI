export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',  // images can be large as base64
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    const apiKey = req.headers['x-api-key'] || '';
    if (!apiKey) return res.status(401).json({ error: { type: 'no_api_key', message: 'No API key' } });

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (body.tools?.some(t => t.type === 'web_search_20250305')) {
      headers['anthropic-beta'] = 'web-search-2025-03-05';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Count actual web search calls — server_tool_use blocks = each individual search
    let webSearchCount = 0;
    if (data.content && Array.isArray(data.content)) {
      webSearchCount = data.content.filter(block =>
        block.type === 'server_tool_use' ||
        (block.type === 'tool_use' && block.name === 'web_search')
      ).length;
    }
    if (data.usage) {
      data.usage._web_search_count = webSearchCount;
    }

    return res.status(response.status).json(data);

  } catch (err) {
    return res.status(500).json({ error: { type: 'proxy_error', message: err.message } });
  }
}
