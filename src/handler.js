/**
 * ZUKO XMD — handler.js
 */

const fs = require('fs');
const path = require('path');
const { getContentType } = require('@whiskeysockets/baileys');
const { getPrefix, getOwner, loadConfig, saveConfig } = require('./config');

const NEWSLETTER_JID = '120363405724402785@newsletter';

function getBody(msg) {
  if (!msg.message) return '';
  
  const m = msg.message.ephemeralMessage?.message ||
    msg.message.viewOnceMessage?.message ||
    msg.message.viewOnceMessageV2?.message ||
    msg.message;
  
  const type = getContentType(m);
  if (!type) return '';
  
  const c = m[type];
  if (!c) return '';
  
  switch (type) {
    case 'conversation': return c;
    case 'extendedTextMessage': return c.text || '';
    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
    case 'audioMessage':
    case 'stickerMessage': return c.caption || '';
    default: return c.text || c.caption || '';
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
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}h ${m}m ${sec}s`;
}

function isOwner(msg, phone) {
  const owner = getOwner(phone);
  const sender = getSender(msg);
  return !!(owner && sender?.includes(owner.split('@')[0]));
}

// Load commands from commands folder
const commands = new Map();
const commandsDir = path.join(__dirname, 'commands'); // Fixed path

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
      }
    } catch (err) {
      console.error(`[ERROR] Failed to load ${file}:`, err.message);
    }
  }
  console.log(`[CMD] ${commands.size} command(s) loaded`);
}

loadCommands();

async function handleMessage(sock, msg, phone) {
  const jid = msg.key.remoteJid;
  if (!jid) return;
  if (!msg.message) return;
  if (jid === 'status@broadcast') return;

  let body = getBody(msg).trim();
  const prefix = getPrefix(phone);
  
  if (!body.startsWith(prefix)) return;

  const [rawCmd, ...args] = body.slice(prefix.length).trim().split(/\s+/);
  const cmdName = rawCmd?.toLowerCase();
  if (!cmdName) return;

  const command = commands.get(cmdName);
  if (!command) return;

  try {
    console.log(`[CMD] ${cmdName} from ${getSender(msg)}`);
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
    await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: msg }).catch(() => {});
  }
}

module.exports = { handleMessage, loadCommands, NEWSLETTER_JID };