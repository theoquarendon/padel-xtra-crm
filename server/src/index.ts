import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pipelineRouter from './routes/pipeline';
import configRouter from './routes/config';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json());

app.use('/api/pipeline', pipelineRouter);
app.use('/api/config', configRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Padel Xtra server running on http://localhost:${PORT}`));
