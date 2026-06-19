export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ result: 'error', message: 'Method not allowed' });
  }

  try {
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

    if (!APPS_SCRIPT_URL) {
      return res.status(500).json({ result: 'error', message: 'Server configuration error' });
    }

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error('Contact handler error:', err);
    return res.status(500).json({ result: 'error', message: 'Something went wrong. Please call 949.448.0961 directly.' });
  }
}
