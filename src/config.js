/**
 * ZUKO XMD — Config Manager
 */

const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'sessions');

function getConfigPath(phone) {
  return path.join(AUTH_DIR, phone, 'config.json');
}

function loadConfig(phone) {
  const p = getConfigPath(phone);
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {}
  return { prefix: '.', owner: null, botName: 'ZUKO XMD', followedNewsletters: [] };
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
  const cfg = loadConfig(phone);
  return cfg.defaultNewsletter || '120363405724402785@newsletter';
}

function setDefaultNewsletter(phone, newsletterJid) {
  const cfg = loadConfig(phone);
  cfg.defaultNewsletter = newsletterJid;
  saveConfig(phone, cfg);
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
};