module.exports = {
  name: 'alive',
  description: 'Check if bot is running with system stats',
  async execute(sock, msg, args, phone, utils) {
    const jid = msg.key.remoteJid;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalMemory = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2);
    const cpuUsage = process.cpuUsage();
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(2);
    
    // Get current time
    const now = new Date();
    const timeStr = now.toLocaleString();
    
    await sock.sendMessage(jid, {
      text: `*⚡ ZUKO XMD IS ALIVE! ⚡*\n\n` +
            `┌─────────────────────────────┐\n` +
            `│ 🤖 *Bot Status*              │\n` +
            `├─────────────────────────────┤\n` +
            `│ ✅ Status: *Online*          │\n` +
            `│ ⏰ Uptime: ${hours}h ${minutes}m ${seconds}s │\n` +
            `│ 💾 Memory: ${memoryUsage} MB / ${totalMemory} MB │\n` +
            `│ 🔄 CPU Usage: ${cpuPercent}% │\n` +
            `│ 🟢 Node: ${process.version}  │\n` +
            `│ 💻 Platform: ${process.platform} │\n` +
            `│ 📅 Time: ${timeStr}          │\n` +
            `└─────────────────────────────┘\n\n` +
            `_All systems operational ✅_\n` +
            `_Bot is ready to serve!_ 🚀`
    }, { quoted: msg });
  }
};