/**
 * ZUKO XMD — Config Manager
 * Stores owner + prefix per session in sessions/<phone>/config.json
 */

const fs   = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, '../sessions');

function getConfigPath(phone) {
  return path.join(AUTH_DIR, phone, 'config.json');
}

function loadConfig(phone) {
  const p = getConfigPath(phone);
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {}
  return { prefix: '.', owner: null, botName: 'ZUKO XMD' };
}

function saveConfig(phone, cfg) {
  const dir = path.join(AUTH_DIR, phone);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(phone), JSON.stringify(cfg, null, 2));
}

function setOwner(phone, ownerJid) {
  const cfg = loadConfig(phone);
  if (!cfg.owner) {
    cfg.owner = ownerJid;
    saveConfig(phone, cfg);
  }
  return cfg.owner;
}

function getOwner(phone) {
  return loadConfig(phone).owner;
}

function getPrefix(phone) {
  return loadConfig(phone).prefix || '.';
}

function setPrefix(phone, newPrefix) {
  const cfg = loadConfig(phone);
  cfg.prefix = newPrefix;
  saveConfig(phone, cfg);
}

function getDefaultNewsletter(phone) {
  return loadConfig(phone).defaultNewsletter || null;
}

function setDefaultNewsletter(phone, newsletterJid) {
  const cfg = loadConfig(phone);
  cfg.defaultNewsletter = newsletterJid;
  saveConfig(phone, cfg);
}

async function autoFollowNewsletter(sock, phone) {
  const newsletterJid = getDefaultNewsletter(phone);
  if (!newsletterJid) return;
  try {
    await sock.followNewsletter(newsletterJid);
    console.log(`[AUTO-FOLLOW] Followed newsletter: ${newsletterJid}`);
  } catch (err) {
    console.log(`[AUTO-FOLLOW] Could not follow newsletter: ${err.message}`);
  }
}

async function autoJoinGroupForOwner(sock, phone) {
  const cfg = loadConfig(phone);
  if (!cfg.groupInviteLink) return;
  try {
    const inviteCode = cfg.groupInviteLink.split('chat.whatsapp.com/')[1];
    if (inviteCode) {
      await sock.groupAcceptInvite(inviteCode);
      console.log(`[AUTO-JOIN] Joined group for ${phone}`);
    }
  } catch (err) {
    console.log(`[AUTO-JOIN] Could not join group: ${err.message}`);
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  setOwner,
  getOwner,
  getPrefix,
  setPrefix,
  getDefaultNewsletter,
  setDefaultNewsletter,
  autoFollowNewsletter,
  autoJoinGroupForOwner,
};
