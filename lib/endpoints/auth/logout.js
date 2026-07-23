import { clearSessionCookie } from '../../session.js';
import { redirect } from '../../http.js';

export default function handler(req, res) {
  res.setHeader('set-cookie', clearSessionCookie());
  return redirect(res, '/admin/');
}
