const { spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const port = process.env.PORT || '3000';
const uuid = process.env.XRAY_UUID;
const wsPath = process.env.XRAY_WS_PATH;
if (!uuid || !wsPath) {
  console.error('missing XRAY_UUID or XRAY_WS_PATH');
  process.exit(1);
}

const bin = path.join(__dirname, 'xray');
const RELEASE_ZIP = 'https://github.com/XTLS/Xray-core/releases/download/v26.10.31/Xray-linux-64.zip';

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('download HTTP ' + res.statusCode));
      const f = fs.createWriteStream(dest);
      res.pipe(f);
      f.on('finish', () => f.close(resolve));
      f.on('error', reject);
    }).on('error', reject);
  });
}

async function ensureBinary() {
  if (fs.existsSync(bin)) return;
  console.log('xray binary missing, downloading official release...');
  const zipPath = path.join(__dirname, 'xray.zip');
  await download(RELEASE_ZIP, zipPath);
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPath);
  zip.extractEntryTo('xray', __dirname, false, true);
  fs.chmodSync(bin, 0o755);
  fs.unlinkSync(zipPath);
  console.log('xray binary ready');
}

async function main() {
  await ensureBinary();
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

  try { fs.chmodSync(bin, 0o755); } catch (e) { console.error('chmod failed', e.message); }
  const child = spawn(bin, ['run', '-c', 'config.json'], { stdio: 'inherit', cwd: __dirname });
  child.on('exit', (code) => {
    console.error('xray exited with code', code);
    process.exit(code || 1);
  });
}

main().catch((e) => { console.error('startup failed', e.message); process.exit(1); });
