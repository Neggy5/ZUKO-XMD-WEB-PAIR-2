module.exports = {
  name: 'ping',
  description: 'Check bot response speed and latency',
  async execute(sock, msg, args, phone, utils) {
    const jid = msg.key.remoteJid;
    const start = Date.now();
    
    // Send initial ping message
    const sentMsg = await sock.sendMessage(jid, { text: '🏓 Pinging...' });
    const ms = Date.now() - start;
    
    // Calculate additional latency
    const latency = Date.now() - start;
    
    await sock.sendMessage(jid, {
      text: `*🏓 PONG!*\n\n` +
            `> Response Speed: *${ms}ms*\n` +
            `> Latency: *${latency}ms*\n` +
            `> Status: *Online ✅*\n` +
            `> Node.js: ${process.version}\n` +
            `> Platform: ${process.platform}\n` +
            `> Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`
    }, { quoted: msg });
  }
};