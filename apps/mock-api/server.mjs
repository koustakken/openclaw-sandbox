import jsonServer from 'json-server';
import crypto from 'node:crypto';

const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

const port = Number(process.env.MOCK_API_PORT ?? 3001);

server.use(middlewares);
server.use(jsonServer.bodyParser);

const accessTokens = new Map();

function issueAccessToken(user) {
  const token = crypto.randomUUID();
  accessTokens.set(token, { sub: user.id, email: user.email });
  return token;
}

function issueRefreshToken(userId) {
  const token = crypto.randomUUID();
  const db = router.db;
  db.get('refreshTokens').remove({ userId }).write();
  db.get('refreshTokens').push({ token, userId, createdAt: new Date().toISOString() }).write();
  return token;
}

server.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mock-api' });
});

server.post('/auth/register', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password || String(password).length < 8) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  const db = router.db;
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = db.get('users').find({ email: normalizedEmail }).value();
  if (existing) {
    return res.status(409).json({ message: 'User already exists' });
  }

  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    password,
    createdAt: new Date().toISOString()
  };

  db.get('users').push(user).write();

  const accessToken = issueAccessToken(user);
  const refreshToken = issueRefreshToken(user.id);

  return res.status(201).json({
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
    accessToken,
    refreshToken
  });
});

server.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const normalizedEmail = String(email ?? '').toLowerCase().trim();

  const db = router.db;
  const user = db.get('users').find({ email: normalizedEmail }).value();
  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const accessToken = issueAccessToken(user);
  const refreshToken = issueRefreshToken(user.id);

  return res.json({
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
    accessToken,
    refreshToken
  });
});

server.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body ?? {};
  const db = router.db;

  const refresh = db.get('refreshTokens').find({ token: refreshToken }).value();
  if (!refresh) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  const user = db.get('users').find({ id: refresh.userId }).value();
  if (!user) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  const nextAccessToken = issueAccessToken(user);
  const nextRefreshToken = issueRefreshToken(user.id);

  return res.json({ accessToken: nextAccessToken, refreshToken: nextRefreshToken });
});

server.post('/auth/logout', (req, res) => {
  const { refreshToken } = req.body ?? {};
  router.db.get('refreshTokens').remove({ token: refreshToken }).write();
  return res.status(204).send();
});

server.get('/auth/me', (req, res) => {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = header.slice('Bearer '.length);
  const payload = accessTokens.get(token);
  if (!payload) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  return res.json({ user: payload });
});

server.use(router);

server.listen(port, () => {
  console.log(`Mock API running on http://localhost:${port}`);
});
