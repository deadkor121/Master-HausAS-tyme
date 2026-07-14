const https = require('https');
const token = process.argv[2];
const projectId = process.argv[3];
const key = process.argv[4];
const value = process.argv[5];

if (!token || !projectId || !key || !value) {
  console.error('Usage: node set-vercel-env.js <token> <projectId> <key> <value>');
  process.exit(2);
}

const data = JSON.stringify({ key, value, target: ['production'], type: 'encrypted' });

const options = {
  hostname: 'api.vercel.com',
  path: `/v2/projects/${projectId}/env`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('status', res.statusCode);
    console.log(body);
  });
});

req.on('error', (e) => { console.error(e); process.exit(1); });
req.write(data);
req.end();
