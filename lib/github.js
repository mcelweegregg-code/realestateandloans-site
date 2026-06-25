// GitHub Git Data API helpers for the publish flow.
//
// CRITICAL: every publish lands as ONE commit containing ALL changed files.
// Two separate commits in quick succession trigger a Vercel race where the
// second build cancels the first and the site can freeze at an intermediate
// state with no error thrown. Never split a publish across commits.

const API = 'https://api.github.com';

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/name"
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !repo) throw new Error('GITHUB_TOKEN and GITHUB_REPO must be set');
  if (!/^[^/]+\/[^/]+$/.test(repo)) throw new Error(`GITHUB_REPO must be "owner/name", got "${repo}"`);
  return { token, repo, branch };
}

async function gh(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Fetch a file's current content from the repo (e.g. blog/index.json). */
export async function fetchRepoFile(filePath) {
  const { token, repo, branch } = getConfig();
  const data = await gh('GET', `/repos/${repo}/contents/${filePath}?ref=${branch}`, token);
  return Buffer.from(data.content, 'base64').toString('utf8');
}

/**
 * Commit a set of files as a single atomic commit on the configured branch.
 * @param {string} message - commit message
 * @param {{path: string, content: string}[]} files
 * @returns {string} the new commit SHA
 */
export async function createSingleCommit(message, files) {
  const { token, repo, branch } = getConfig();
  const base = `/repos/${repo}`;

  const ref = await gh('GET', `${base}/git/ref/heads/${branch}`, token);
  const parentSha = ref.object.sha;
  const parentCommit = await gh('GET', `${base}/git/commits/${parentSha}`, token);

  const tree = await gh('POST', `${base}/git/trees`, token, {
    base_tree: parentCommit.tree.sha,
    tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
  });

  const commit = await gh('POST', `${base}/git/commits`, token, {
    message,
    tree: tree.sha,
    parents: [parentSha],
  });

  await gh('PATCH', `${base}/git/refs/heads/${branch}`, token, { sha: commit.sha });
  return commit.sha;
}
