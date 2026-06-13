/**
 * ZUKO XMD — bot.js
 * Baileys v6.7.18 — permanent stable build
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs   = require('fs');
const { handleMessage } = require('./handler');
const { setOwner, loadConfig, getDefaultNewsletter } = require('./config');

// FIXED: Correct path for sessions (same directory level)
const AUTH_DIR = path.join(__dirname, 'sessions');

async function startZukoBot(phone, socket, io, sessions) {
  const sessionDir = path.join(AUTH_DIR, phone);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version }          = await fetchLatestBaileysVersion();
  const logger               = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys:  makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser:               Browsers.ubuntu('Chrome'),
    mobile:                false,
    printQRInTerminal:     false,
    markOnlineOnConnect:   true,
    syncFullHistory:       false,
    connectTimeoutMs:      60_000,
    defaultQueryTimeoutMs: 30_000,
    keepAliveIntervalMs:   10_000,
    retryRequestDelayMs:   2_000,
    getMessage: async () => ({ conversation: '' }),
  });

  sessions.set(phone, { sock, connected: false, socket });

  let pairingRequested = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, isNewLogin } = update;
    if (connection) console.log(`[ZUKO XMD] [${phone}] connection: ${connection}`);

    // Request pairing code after connection opens
    if (connection === 'open' && !pairingRequested && !state.creds.registered) {
      pairingRequested = true;
      socket.emit('status', { message: '📲 Requesting pairing code...', type: 'info' });
      
      try {
        const cleanPhone = phone.replace(/\D/g, '');
        const code       = await sock.requestPairingCode(cleanPhone);
        const formatted  = code?.match(/.{1,4}/g)?.join('-') || code;
        
        console.log(`[ZUKO XMD] ✅ Pairing code for ${cleanPhone}: ${formatted}`);
        
        socket.emit('pairing-code', {
          code:    formatted,
          phone:   cleanPhone,
          message: 'Enter this code in WhatsApp → Linked Devices → Link with Phone Number',
        });
        socket.emit('status', {
          message: `🔑 Code: ${formatted} — enter it in WhatsApp now`,
          type: 'code',
        });
      } catch (err) {
        console.error('[ZUKO XMD] Pairing code error:', err.message);
        pairingRequested = false;
        socket.emit('error', {
          message: `Pairing code failed: ${err.message}`,
        });
      }
      return;
    }

    // Fully connected & authenticated
    if ((connection === 'open' && state.creds.registered) || isNewLogin) {
      const session = sessions.get(phone);
      if (session) session.connected = true;

      const user     = sock.user;
      const name     = user?.name || user?.verifiedName || phone;
      const ownerJid = user?.id;
      if (ownerJid) setOwner(phone, ownerJid);

      console.log(`[ZUKO XMD] ✅ Connected as ${name}`);
      socket.emit('connected', { phone, name, message: `✅ ZUKO XMD connected as ${name}` });
      socket.emit('status', { message: '🚀 Bot is live!', type: 'success' });

      await sendWelcomeMessage(sock, phone, ownerJid, socket);
    }

    // Disconnected
    if (connection === 'close') {
      const statusCode      = lastDisconnect?.error?.output?.statusCode;
      const reason          = lastDisconnect?.error?.message || 'Unknown';
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
                           && statusCode !== DisconnectReason.forbidden;

      console.log(`[ZUKO XMD] [${phone}] Closed. Code: ${statusCode} | ${reason}`);

      if (!state.creds.registered && pairingRequested) {
        socket.emit('status', {
          message: '⚠️ Waiting for WhatsApp to connect. Make sure you entered the code correctly.',
          type: 'warning',
        });
      }

      socket.emit('status', {
        message: shouldReconnect ? '⚠️ Disconnected. Reconnecting in 5s...' : '❌ Logged out. Please re-pair.',
        type: shouldReconnect ? 'warning' : 'error',
      });

      if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.forbidden) {
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
        sessions.delete(phone);
        socket.emit('logged-out', { phone });
      } else if (shouldReconnect) {
        sessions.delete(phone);
        setTimeout(() => startZukoBot(phone, socket, io, sessions), 5000);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      await handleMessage(sock, msg, phone).catch(console.error);
    }
  });

  return sock;
}

async function sendWelcomeMessage(sock, phone, ownerJid, socket) {
  if (!ownerJid) return;

  const domain   = process.env.RAILWAY_PUBLIC_DOMAIN
                || process.env.RENDER_EXTERNAL_URL
                || process.env.PUBLIC_URL
                || `localhost:${process.env.PORT || 3000}`;
  const protocol = domain.startsWith('localhost') ? 'http' : 'https';
  const webUrl   = `${protocol}://${domain}`;

  const cfg        = loadConfig(phone);
  const prefix     = cfg.prefix || '.';
  const newsletter = getDefaultNewsletter(phone);

  const text =
    `╔══════════════════════════════════╗\n` +
    `║     ⚡  ZUKO XMD ACTIVATED  ⚡     ║\n` +
    `╚══════════════════════════════════╝\n\n` +
    `*✨ Your bot is now ONLINE and ready!*\n\n` +
    `🌐 *Web Panel:* ${webUrl}\n\n` +
    `📰 *Newsletter:* ${newsletter || 'Not configured'}\n\n` +
    `*📌 Quick Commands:*\n` +
    `› *${prefix}menu* — all commands\n` +
    `› *${prefix}ping* — check speed\n` +
    `› *${prefix}alive* — system stats\n\n` +
    `_Thank you for using ZUKO XMD!_ 🚀`;

  setTimeout(async () => {
    try {
      await sock.sendMessage(ownerJid, { text });
      socket.emit('status', { message: '✅ Welcome message sent to WhatsApp!', type: 'success' });
    } catch (err) {
      console.error(`[ZUKO XMD] Welcome msg failed: ${err.message}`);
    }
  }, 3000);
}

module.exports = { startZukoBot };