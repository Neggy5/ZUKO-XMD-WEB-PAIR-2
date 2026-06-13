/**
 * ZUKO XMD — index.js
 */

const express          = require('express');
const { createServer } = require('http');
const { Server }       = require('socket.io');
const path             = require('path');
const fs               = require('fs');
const cors             = require('cors');
const { startZukoBot } = require('./bot');

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // FIXED: removed ../

const sessions = new Map();
const AUTH_DIR = path.join(__dirname, 'sessions'); // FIXED: removed ../

// ── Routes ─────────────────────────────────────────────────────────────────
app.get('/',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html'))); // FIXED
app.get('/health', (req, res) => res.json({ status: 'alive', bot: 'ZUKO XMD', version: '2.0.0' }));
app.get('/api/sessions', (req, res) => {
  const active = [...sessions.entries()]
    .filter(([, v]) => v.connected)
    .map(([phone]) => ({ phone: phone.slice(0, 4) + '****' + phone.slice(-3) }));
  res.json({ count: active.length, sessions: active });
});

// ── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[ZUKO XMD] Web client: ${socket.id}`);

  socket.on('request-pairing', async (data) => {
    const phone = data?.phone?.replace(/\D/g, '');
    if (!phone || phone.length < 7) {
      return socket.emit('error', { message: 'Invalid phone number — include country code e.g. 2348012345678' });
    }

    if (sessions.has(phone)) {
      const ex = sessions.get(phone);
      if (ex.connected) return socket.emit('already-connected', { phone });
      try { ex.sock?.end(); } catch (_) {}
      sessions.delete(phone);
    }

    // Clear old session folder
    const sessionDir = path.join(AUTH_DIR, phone);
    if (fs.existsSync(sessionDir)) {
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
    }

    socket.emit('status', { message: '⚡ Initializing ZUKO XMD...', type: 'info' });
    try {
      await startZukoBot(phone, socket, io, sessions);
    } catch (err) {
      console.error('[ZUKO XMD] Start error:', err.message);
      socket.emit('error', { message: 'Failed to start. Try again.' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[ZUKO XMD] Web client left: ${socket.id}`);
  });
});

// ── Auto-restore sessions on boot ──────────────────────────────────────────
async function restoreSessions() {
  if (!fs.existsSync(AUTH_DIR)) return;

  const dirs = fs.readdirSync(AUTH_DIR).filter(d =>
    fs.existsSync(path.join(AUTH_DIR, d, 'creds.json'))
  );

  if (!dirs.length) return;
  console.log(`[ZUKO XMD] Restoring ${dirs.length} session(s)...`);

  for (const phone of dirs) {
    try {
      const dummySocket = {
        emit: (event, data) => {
          if (event === 'status')    console.log(`[RESTORE:${phone}] ${data.message}`);
          if (event === 'connected') console.log(`[RESTORE:${phone}] ✅ ${data.message}`);
          if (event === 'error')     console.error(`[RESTORE:${phone}] ❌ ${data.message}`);
        },
      };
      await startZukoBot(phone, dummySocket, io, sessions);
    } catch (err) {
      console.error(`[RESTORE] Failed for ${phone}:`, err.message);
    }
  }
}

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, async () => {
  console.log(`\n╔══════════════════════════════════╗`);
  console.log(`║      ZUKO XMD  ◈  ONLINE         ║`);
  console.log(`║  Web Panel → http://localhost:${PORT} ║`);
  console.log(`╚══════════════════════════════════╝\n`);
  await restoreSessions();
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
function shutdown(sig) {
  console.log(`[ZUKO XMD] ${sig} — shutting down...`);
  for (const [, session] of sessions) {
    try { session.sock?.end(); } catch (_) {}
  }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  err  => console.error('[ZUKO XMD] uncaughtException:', err.message));
process.on('unhandledRejection', reason => console.error('[ZUKO XMD] unhandledRejection:', reason));