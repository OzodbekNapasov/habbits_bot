import http from 'http';
import fs from 'fs';
import path from 'path';
import { getHabits, getUsers } from './database';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const PUBLIC_DIR = path.join(process.cwd(), 'public');

/**
 * Initializes the HTTP Web Server for serving Telegram Mini App & REST APIs.
 */
export function startWebServer(): void {
  const server = http.createServer((req, res) => {
    const reqUrl = req.url || '/';
    const parsedUrl = new URL(reqUrl, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    // API Endpoint: /api/habits
    if (pathname === '/api/habits') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const userIdParam = parsedUrl.searchParams.get('userId');
      let habits: any[] = [];

      if (userIdParam) {
        const userId = parseInt(userIdParam, 10);
        habits = getHabits(userId);
      } else {
        const users = getUsers();
        habits = users.length > 0 ? users[0].habits : [];
      }

      res.writeHead(200);
      res.end(JSON.stringify({ habits }));
      return;
    }

    // Static File Server (Serving public/index.html)
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType =
      ext === '.css'
        ? 'text/css'
        : ext === '.js'
        ? 'text/javascript'
        : ext === '.json'
        ? 'application/json'
        : 'text/html';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    } catch (error) {
      res.writeHead(500);
      res.end('Server Xatoligi');
    }
  });

  server.listen(PORT, () => {
    console.log(`🌐 Web App server ishga tushdi: http://localhost:${PORT}`);
  });
}
