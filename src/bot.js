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
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs   = require('fs');
const { handleMessage } = require('./handler');
const { setOwner, loadConfig, getDefaultNewsletter } = require('./config');

const AUTH_DIR = path.join(__dirname, 'sessions');

async function startZukoBot(phone, socket, io, sessions) {
  const sessionDir = path.join(AUTH_DIR, phone);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: ['ZUKO XMD', 'Chrome', '120.0.0'],
    mobile: false,
    printQRInTerminal: false,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 30_000,
    keepAliveIntervalMs: 30_000,
    retryRequestDelayMs: 5_000,
    getMessage: async () => ({ conversation: '' }),
  });

  sessions.set(phone, { sock, connected: false, socket });

  let pairingRequested = false;
  let authenticated = false;

  // Send initial status
  socket.emit('status', { message: '🔌 Connecting to WhatsApp...', type: 'info' });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, isNewLogin, qr } = update;
    
    console.log(`[ZUKO XMD] [${phone}] Update:`, JSON.stringify(update, null, 2));
    
    // Handle QR if needed (fallback)
    if (qr && !state.creds.registered) {
      console.log(`[ZUKO XMD] [${phone}] QR received`);
      socket.emit('status', { message: 'QR code generated (use pairing code instead)', type: 'info' });
    }

    // Request pairing code when connection is ready
    if (connection === 'open' && !pairingRequested && !state.creds.registered) {
      pairingRequested = true;
      socket.emit('status', { message: '📱 Requesting pairing code...', type: 'info' });
      
      // Small delay to ensure connection is stable
      setTimeout(async () => {
        try {
          const cleanPhone = phone.replace(/\D/g, '');
          console.log(`[ZUKO XMD] [${phone}] Requesting code for: ${cleanPhone}`);
          
          const code = await sock.requestPairingCode(cleanPhone);
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
          
          console.log(`[ZUKO XMD] [${phone}] Code: ${formatted}`);
          
          socket.emit('pairing-code', {
            code: formatted,
            phone: cleanPhone,
            message: 'Enter this code in WhatsApp',
          });
          socket.emit('status', {
            message: `✅ Code generated! Enter: ${formatted}`,
            type: 'code',
          });
        } catch (err) {
          console.error(`[ZUKO XMD] [${phone}] Pairing error:`, err.message);
          pairingRequested = false;
          socket.emit('error', { 
            message: `Pairing failed: ${err.message}. Try again.` 
          });
        }
      }, 2000);
    }

    // Handle successful authentication
    if ((connection === 'open' && state.creds.registered) || isNewLogin) {
      if (!authenticated) {
        authenticated = true;
        const session = sessions.get(phone);
        if (session) session.connected = true;

        const user = sock.user;
        const name = user?.name || user?.verifiedName || phone;
        const ownerJid = user?.id;
        
        if (ownerJid) {
          setOwner(phone, ownerJid);
          console.log(`[ZUKO XMD] [${phone}] Owner set: ${ownerJid}`);
        }

        console.log(`[ZUKO XMD] [${phone}] Connected as: ${name}`);
        
        socket.emit('connected', { 
          phone, 
          name, 
          message: `✅ Connected as ${name}` 
        });
        socket.emit('status', { 
          message: '🎉 Bot is live!', 
          type: 'success' 
        });

        // Send welcome message after connection
        setTimeout(async () => {
          await sendWelcomeMessage(sock, phone, ownerJid, socket);
        }, 3000);
      }
    }

    // Handle disconnection
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || 'Unknown';
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut &&
                             statusCode !== DisconnectReason.forbidden;

      console.log(`[ZUKO XMD] [${phone}] Closed: Code=${statusCode}, Reason=${reason}`);

      if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.forbidden) {
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          console.log(`[ZUKO XMD] [${phone}] Session cleared`);
        } catch (_) {}
        sessions.delete(phone);
        socket.emit('logged-out', { phone });
        socket.emit('status', { 
          message: 'Session expired. Please pair again.', 
          type: 'error' 
        });
      } else if (shouldReconnect && !authenticated) {
        pairingRequested = false;
        socket.emit('status', { 
          message: 'Connection lost. Reconnecting...', 
          type: 'warning' 
        });
        setTimeout(() => {
          sessions.delete(phone);
          startZukoBot(phone, socket, io, sessions);
        }, 5000);
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

  const domain = process.env.RAILWAY_PUBLIC_DOMAIN ||
                process.env.RENDER_EXTERNAL_URL ||
                process.env.PUBLIC_URL ||
                `localhost:${process.env.PORT || 3000}`;
  const protocol = domain.startsWith('localhost') ? 'http' : 'https';
  const webUrl = `${protocol}://${domain}`;

  const cfg = loadConfig(phone);
  const prefix = cfg.prefix || '.';
  const newsletter = getDefaultNewsletter(phone);

  const text =
    `╔══════════════════════════════════╗\n` +
    `║     ⚡  ZUKO XMD ACTIVATED  ⚡     ║\n` +
    `╚══════════════════════════════════╝\n\n` +
    `*✨ Your bot is now ONLINE!*\n\n` +
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
      console.log(`[ZUKO XMD] Welcome sent to ${ownerJid}`);
    } catch (err) {
      console.error(`[ZUKO XMD] Welcome failed: ${err.message}`);
    }
  }, 3000);
}

module.exports = { startZukoBot };