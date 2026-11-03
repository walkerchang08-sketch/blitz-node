const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || '3000';
const uuid = process.env.XRAY_UUID;
const wsPath = process.env.XRAY_WS_PATH;
if (!uuid || !wsPath) {
  console.error('missing XRAY_UUID or XRAY_WS_PATH');
  process.exit(1);
}

const config = {
  log: { loglevel: 'warning' },
  inbounds: [{
    listen: '0.0.0.0',
    port: Number(port),
    protocol: 'vless',
    settings: { clients: [{ id: uuid, flow: '' }], decryption: 'none' },
    sniffing: { enabled: true, destOverride: ['http', 'tls'] },
    streamSettings: { network: 'ws', wsSettings: { path: wsPath } },
  }],
  outbounds: [{ protocol: 'freedom' }],
};
fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config));

const bin = path.join(__dirname, 'xray');
try { fs.chmodSync(bin, 0o755); } catch (e) { console.error('chmod failed', e.message); }
const child = spawn(bin, ['run', '-c', 'config.json'], { stdio: 'inherit', cwd: __dirname });
child.on('exit', (code) => {
  console.error('xray exited with code', code);
  process.exit(code || 1);
});
