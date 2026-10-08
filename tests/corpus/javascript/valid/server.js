// covers: (none) CommonJS, a promise chain split across lines
const http = require('http');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === 'GET' && req.url === '/version') {
    fs.promises
      .readFile('package.json', 'utf8')
      .then((text) => JSON.parse(text).version)
      .then((version) => sendJson(res, 200, { version }))
      .catch((err) => {
        console.error(err);
        sendJson(res, 500, { error: 'could not read version' });
      });
    return;
  }
  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}`);
});

module.exports = { sendJson };
