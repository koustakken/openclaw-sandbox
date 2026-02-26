import express from 'express';
import cors from 'cors';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'api' });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
