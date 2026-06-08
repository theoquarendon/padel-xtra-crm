import { Router } from 'express';
import { getConfigValue, setConfigValue } from '../sheets';

const router = Router();

router.get('/:key', async (req, res) => {
  try {
    const value = await getConfigValue(req.params.key);
    res.json({ value });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.put('/:key', async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value required' });
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    await setConfigValue(req.params.key, str);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
