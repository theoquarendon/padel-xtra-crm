import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pipelineRouter from '../server/src/routes/pipeline';
import configRouter from '../server/src/routes/config';
import { appendRow, readRows, deleteRow } from '../server/src/sheets';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/pipeline', pipelineRouter);
app.use('/api/config', configRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Live write/read/delete test against Google Sheets — call this from the browser
// to confirm whether Vercel's credentials can actually write, not just read.
app.get('/api/health/sheets', async (_req, res) => {
  const testName = '__health_' + Date.now();
  const steps: string[] = [];
  try {
    steps.push('reading existing rows...');
    const before = await readRows('Pipeline');
    steps.push(`read ok — ${before.length} rows`);

    steps.push('appending test row...');
    await appendRow('Pipeline', [testName]);
    steps.push('append ok');

    steps.push('reading back...');
    const after = await readRows('Pipeline');
    const idx = after.findIndex(r => r[0] === testName);
    if (idx === -1) {
      steps.push(`read-back FAILED — row not found in ${after.length} rows`);
      return res.status(500).json({ ok: false, steps });
    }
    steps.push(`read-back ok — found at index ${idx}`);

    steps.push('deleting test row...');
    const deleted = await deleteRow('Pipeline', testName);
    steps.push(deleted ? 'delete ok' : 'delete returned false (not found)');

    res.json({ ok: true, steps, spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID, email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const google = (e as any)?.response?.data?.error;
    steps.push(`EXCEPTION: ${err}${google ? ` [Google ${google.code}: ${google.message}]` : ''}`);
    console.error('[health/sheets] error:', err, google ?? '');
    res.status(500).json({ ok: false, steps, error: err, google });
  }
});

export default app;
