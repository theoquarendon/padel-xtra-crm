import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pipelineRouter from '../server/src/routes/pipeline';
import configRouter from '../server/src/routes/config';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/pipeline', pipelineRouter);
app.use('/api/config', configRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

export default app;
