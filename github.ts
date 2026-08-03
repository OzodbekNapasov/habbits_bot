import dotenv from 'dotenv';
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'OzodbekNapasov/habbits_bot';
const FILE_PATH = 'db.json';

interface GitHubFileResponse {
  sha: string;
  content: string; // Base64 encoded
}

let cachedSha: string | null = null;

export async function fetchDbFromGitHub(): Promise<{ content: string; sha: string } | null> {
  if (!GITHUB_TOKEN) {
    console.warn("⚠️ GITHUB_TOKEN is not set, falling back to local file.");
    return null;
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'telegram-habits-bot'
      }
    });

    if (res.status === 404) {
      console.log("db.json not found on GitHub, returning empty database.");
      return { content: JSON.stringify({ users: [] }), sha: '' };
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub API error: ${res.status} - ${errText}`);
    }

    const data = await res.json() as GitHubFileResponse;
    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
    cachedSha = data.sha;
    return { content: decoded, sha: data.sha };
  } catch (err) {
    console.error("❌ Error fetching db.json from GitHub:", err);
    return null;
  }
}

export async function saveDbToGitHub(content: string): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    return false;
  }

  // To update a file, we MUST have the current SHA.
  let sha = cachedSha;
  if (!sha) {
    const fetched = await fetchDbFromGitHub();
    if (fetched) {
      sha = fetched.sha;
    }
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const body = {
    message: 'chore: update database state [bot]',
    content: Buffer.from(content, 'utf-8').toString('base64'),
    sha: sha || undefined
  };

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'telegram-habits-bot'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub API error: ${res.status} - ${errText}`);
    }

    const data = await res.json() as any;
    cachedSha = data.content.sha;
    console.log("🔄 Database successfully synchronized with GitHub!");
    return true;
  } catch (err) {
    console.error("❌ Error saving db.json to GitHub:", err);
    cachedSha = null;
    return false;
  }
}
