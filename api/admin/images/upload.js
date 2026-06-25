// POST /api/admin/images/upload — add an image to the library.
//
// The image arrives as base64 JSON ({ filename, mime, data_base64, alt_text }),
// matching api/admin/record.js so body handling is identical across Vercel and
// the dev server with no multipart dependency. The binary is committed into the
// repo at assets/images/blog/owned/<file> (the same site-root-relative path
// convention images.filename already uses), then a row is inserted into the
// images table (source 'owned', used false). Auth-gated.

import { requireRole } from '../../../lib/admin-auth.js';
import { sendJson, readJsonBody } from '../../../lib/http.js';
import { isMock } from '../../../lib/mock.js';
import { insertImage } from '../../../lib/admin-data.js';
import { createSingleCommit } from '../../../lib/github.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_DIR = 'assets/images/blog/owned';
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];

/** Slugify the base name and keep a safe extension; prefix a timestamp to avoid collisions. */
function safeFilename(rawName, mime) {
  const dot = rawName.lastIndexOf('.');
  const base = (dot > 0 ? rawName.slice(0, dot) : rawName) || 'image';
  let ext = (dot > 0 ? rawName.slice(dot + 1) : '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) ext = EXT_BY_MIME[mime] || '';
  if (ext === 'jpeg') ext = 'jpg';
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
  return { ext, name: `${Date.now()}-${slug}.${ext}` };
}

export default async function handler(req, res) {
  const session = requireRole(req, res, ['gregg', 'editor']);
  if (!session) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });

  try {
    const { filename, mime, data_base64: dataBase64, alt_text: altText } = await readJsonBody(req);
    if (!dataBase64) return sendJson(res, 400, { error: 'data_base64 is required' });
    if (!altText || !String(altText).trim()) return sendJson(res, 400, { error: 'alt_text is required' });

    const { ext, name } = safeFilename(filename || '', mime);
    if (!ALLOWED_EXT.includes(ext)) {
      return sendJson(res, 400, { error: 'only jpg, png and webp images are accepted' });
    }

    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length === 0) return sendJson(res, 400, { error: 'image is empty' });
    if (buffer.length > MAX_IMAGE_BYTES) return sendJson(res, 413, { error: 'image too large (max 8MB)' });

    const repoPath = `${IMAGE_DIR}/${name}`;

    if (!isMock()) {
      await createSingleCommit(`Add library image: ${name}`, [
        { path: repoPath, contentBase64: buffer.toString('base64') },
      ]);
    }

    const image = await insertImage({ filename: repoPath, alt_text: String(altText).trim() });
    return sendJson(res, 200, { ok: true, image });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
