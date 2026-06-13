# ⚡ ZUKO XMD v2.0 — WhatsApp Bot

Zero-config WhatsApp bot. No environment variables needed. The first person to pair becomes the owner automatically.

---

## 🚀 Deploy to Railway

### Option A — GitHub (Recommended)

```bash
git init
git add .
git commit -m "ZUKO XMD v2"
git remote add origin https://github.com/YOUR_USERNAME/zuko-xmd.git
git push -u origin main
```

Then on [railway.app](https://railway.app):
- **New Project → Deploy from GitHub repo** → select your repo
- Railway detects Node.js and deploys automatically
- **Settings → Networking → Generate Domain**
- Open the domain → enter your number → get code → done ✅

**No environment variables required.** Everything is auto-configured.

### Option B — Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway domain
```

---

## 📱 How to Pair

1. Open your Railway domain in a browser
2. Enter your number with country code (e.g. `2348012345678`)
3. Click **Get Code** → an 8-digit code appears
4. On WhatsApp: **⋮ Menu → Linked Devices → Link a Device → Link with Phone Number**
5. Enter the code → ✅ connected instantly

**The first number to pair is automatically set as the bot owner.**

---

## 💬 Commands (35+)

### GENERAL
| Command | Description |
|---|---|
| `.menu` | Show full command menu |
| `.ping` | Check bot speed |
| `.alive` | Alive + system stats |
| `.info` | Bot information |
| `.owner` | Show bot owner |
| `.setprefix <symbol>` | Change prefix (owner only) |

### FUN
| Command | Description |
|---|---|
| `.say <text>` | Bot repeats your text |
| `.time` | Current time and date |
| `.calc 10 * 5 + 2` | Calculator |
| `.flip` | Coin flip |
| `.dice` or `.dice 20` | Roll a dice |
| `.quote` | Random motivational quote |
| `.8ball <question>` | Magic 8 ball |
| `.choose a \| b \| c` | Pick randomly from options |

### GROUP
| Command | Description |
|---|---|
| `.tagall <message>` | Mention all members |
| `.kick @user` | Remove member |
| `.promote @user` | Make admin |
| `.demote @user` | Remove admin |
| `.groupinfo` | Show group details |
| `.mute` | Lock group (admins only) |
| `.unmute` | Unlock group |
| `.link` | Get invite link |
| `.members` | List all members |

### OWNER ONLY
| Command | Description |
|---|---|
| `.broadcast <msg>` | Send to all groups |
| `.block @user` | Block a user |
| `.unblock @user` | Unblock a user |
| `.setprefix !` | Change command prefix |

---

## 🛠 Local Dev

```bash
npm install
npm start
# Open http://localhost:3000
```

---

## 📁 Structure

```
zuko-xmd/
├── src/
│   ├── index.js    # Express + Socket.io server
│   ├── bot.js      # Baileys + pairing code logic
│   ├── handler.js  # All commands
│   └── config.js   # Auto owner/prefix config manager
├── public/
│   └── index.html  # Web panel
├── railway.toml
├── Procfile
└── package.json
```

---

Made with ⚡ ZUKO XMD v2.0
