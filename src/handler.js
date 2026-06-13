/**
 * ZUKO XMD — handler.js
 * Baileys v6.7.18 — permanent stable build
 *
 * Fixes:
 *  - fromMe NOT blocked → owner commands from own phone work
 *  - Full getBody() covering all message types + ephemeral wrappers
 *  - status@broadcast skipped to prevent reply errors
 *  - Require cache cleared so commands hot-reload properly
 */

const fs   = require('fs');
const path = require('path');
const { getContentType } = require('@whiskeysockets/baileys');
const { getPrefix, getOwner, loadConfig, saveConfig } = require('./config');

const NEWSLETTER_JID = '120363405724402785@newsletter';

// ── Body extraction — covers every message type ───────────────────────────
function getBody(msg) {
  if (!msg.message) return '';

  // Unwrap ephemeral / view-once containers first
  const m =
    msg.message.ephemeralMessage?.message ||
    msg.message.viewOnceMessage?.message  ||
    msg.message.viewOnceMessageV2?.message ||
    msg.message;

  const type = getContentType(m);
  if (!type) return '';

  const c = m[type];
  if (!c) return '';

  switch (type) {
    case 'conversation':               return c;
    case 'extendedTextMessage':        return c.text || '';
    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
    case 'audioMessage':
    case 'stickerMessage':             return c.caption || '';
    case 'buttonsResponseMessage':     return c.selectedButtonId || c.selectedDisplayText || '';
    case 'listResponseMessage':        return c.singleSelectReply?.selectedRowId || '';
    case 'templateButtonReplyMessage': return c.selectedId || '';
    default:                           return c.text || c.caption || '';
  }
}

function getSender(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function isGroup(msg) {
  return msg.key.remoteJid?.endsWith('@g.us');
}

function isNewsletter(msg) {
  return msg.key.remoteJid?.endsWith('@newsletter');
}

function formatUptime(s) {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}h ${m}m ${sec}s`;
}

function isOwner(msg, phone) {
  const owner  = getOwner(phone);
  const sender = getSender(msg);
  return !!(owner && sender?.includes(owner.split('@')[0]));
}

// ── Newsletter forwarded content ──────────────────────────────────────────
function getForwardedContent(msg) {
  const type = getContentType(msg.message);
  const c    = msg.message?.[type];
  if (!c?.contextInfo) return null;
  if (c.contextInfo.newsletterJid !== NEWSLETTER_JID) return null;

  const q = c.contextInfo.quotedMessage;
  if (q) {
    const qt = getContentType(q);
    const qc = q[qt];
    if (qc?.text)    return qc.text;
    if (qc?.caption) return qc.caption;
  }
  if (type === 'extendedTextMessage' && c.text) return c.text;
  if (c.caption) return c.caption;
  return null;
}

// ── Load commands ─────────────────────────────────────────────────────────
const commands    = new Map();
const commandsDir = path.join(__dirname, '../commands');

function loadCommands() {
  if (!fs.existsSync(commandsDir)) {
    console.error('[ERROR] commands/ folder not found at:', commandsDir);
    return;
  }
  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const filePath = path.join(commandsDir, file);
    try {
      delete require.cache[require.resolve(filePath)];
      const cmd = require(filePath);
      if (cmd.name && typeof cmd.execute === 'function') {
        commands.set(cmd.name.toLowerCase(), cmd);
        console.log(`[CMD] Loaded: ${cmd.name.toLowerCase()}`);
      } else {
        console.warn(`[WARN] ${file} missing name or execute — skipped`);
      }
    } catch (err) {
      console.error(`[ERROR] Failed to load ${file}:`, err.message);
    }
  }
  console.log(`[CMD] ${commands.size} command(s) loaded`);
}

loadCommands();

// ── Main message handler ──────────────────────────────────────────────────
async function handleMessage(sock, msg, phone) {
  const jid = msg.key.remoteJid;
  if (!jid)                          return; // no destination
  if (!msg.message)                  return; // empty message
  if (jid === 'status@broadcast')    return; // skip WA status updates

  // ⚠️  Do NOT block fromMe — owner sends commands from their own phone
  //    (msg.key.fromMe === true for messages YOU send)

  let body = getBody(msg).trim();

  // Override body if this is a newsletter-forwarded command
  const forwarded = getForwardedContent(msg);
  if (forwarded) {
    const prefix = getPrefix(phone);
    if (forwarded.startsWith(prefix)) body = forwarded;
  }

  const prefix = getPrefix(phone);
  if (!body.startsWith(prefix)) return;

  const [rawCmd, ...args] = body.slice(prefix.length).trim().split(/\s+/);
  const cmdName = rawCmd?.toLowerCase();
  if (!cmdName) return;

  const command = commands.get(cmdName);
  if (!command) return; // unknown command — silently ignore

  try {
    console.log(`[CMD] ${cmdName} | sender: ${getSender(msg)} | jid: ${jid}`);
    await command.execute(sock, msg, args, phone, {
      getPrefix,
      getOwner,
      loadConfig,
      saveConfig,
      isOwner,
      isGroup,
      isNewsletter,
      formatUptime,
      NEWSLETTER_JID,
    });
  } catch (err) {
    console.error(`[ERROR] "${cmdName}":`, err.message);
    await sock.sendMessage(jid, {
      text: `❌ Error in *${cmdName}*: ${err.message}`,
    }, { quoted: msg }).catch(() => {});
  }
}

module.exports = { handleMessage, loadCommands, NEWSLETTER_JID };
