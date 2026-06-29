import { randomUUID } from 'crypto';
import { Router } from 'express';
import { appendRow, updateRow, deleteRow, readRows } from '../sheets';

function errMsg(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const google = (e as any).response?.data?.error;
  const detail = google ? ` [Google ${google.code}: ${google.message}]` : '';
  console.error('[pipeline] error:', e.message + detail, (e as any).response?.data ?? '');
  return e.message + detail;
}

const router = Router();
const SHEET = 'Pipeline';

// Sheet columns: A=Name | B=Location | C=Stage | D=DealType | E=SizeSqFt | F=Landlord | G=RentPsf | H=TotalRentPa | I=EstRatesPa | J=Notes | K=LastContacted | L=BrochureUrl | M=MapUrl | N=SaleLetType | O=CapValuePsf | P=NextAction | Q=NextActionDate | R=OperatingProfit | S=FloorPlanUrl | T=ID (UUID)
// T (col 20, index 19) is a stable UUID written on create; legacy rows without a UUID fall back to col A name.
const toObj = (r: string[]) => ({
  id:              (r[19] && String(r[19]).trim()) ? String(r[19]).trim() : (r[0] || ''),
  name:            r[0] || '',
  location:        r[1] || '',
  stage:           r[2] || 'Identified',
  dealType:        r[3] || '',
  sizeSqFt:        r[4] || '',
  landlord:        r[5] || '',
  rentPsf:         r[6] || '',
  totalRentPa:     r[7] || '',
  estRatesPa:      r[8] || '',
  notes:           r[9] || '',
  lastContacted:   r[10] || '',
  brochureUrl:     r[11] || '',
  mapUrl:          r[12] || '',
  saleLetType:     r[13] || '',
  capValuePsf:     r[14] || '',
  nextAction:      r[15] || '',
  nextActionDate:  r[16] || '',
  operatingProfit: r[17] || '',
  floorPlanUrl:    r[18] || '',
});

const toRow = (p: ReturnType<typeof toObj>) => [
  p.name, p.location, p.stage, p.dealType, p.sizeSqFt,
  p.landlord, p.rentPsf, p.totalRentPa, p.estRatesPa, p.notes,
  p.lastContacted, p.brochureUrl, p.mapUrl, p.saleLetType, p.capValuePsf,
  p.nextAction, p.nextActionDate, p.operatingProfit, p.floorPlanUrl,
  p.id,  // col T: UUID (stable identifier)
];

router.get('/', async (_req, res) => {
  try {
    const rows = await readRows(SHEET);
    res.json(rows.filter(r => r[0]).map(toObj));
  } catch (e) {
    res.status(500).json({ error: errMsg(e) });
  }
});

router.post('/', async (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'name required' });
  try {
    const prop = toObj([
      req.body.name, req.body.location, req.body.stage, req.body.dealType,
      req.body.sizeSqFt, req.body.landlord, req.body.rentPsf,
      req.body.totalRentPa, req.body.estRatesPa, req.body.notes,
      req.body.lastContacted ?? '', req.body.brochureUrl ?? '', req.body.mapUrl ?? '',
      req.body.saleLetType ?? '', req.body.capValuePsf ?? '',
      req.body.nextAction ?? '', req.body.nextActionDate ?? '',
      req.body.operatingProfit ?? '', req.body.floorPlanUrl ?? '',
      randomUUID(), // col T: generate stable UUID on creation
    ]);
    await appendRow(SHEET, toRow(prop));
    res.json(prop);
  } catch (e) {
    res.status(500).json({ error: errMsg(e) });
  }
});

router.put('/:id', async (req, res) => {
  console.log('[PUT] params.id=', JSON.stringify(req.params.id), '| body.name=', JSON.stringify(req.body?.name), '| body keys=', Object.keys(req.body || {}));
  if (!req.body?.name) return res.status(400).json({ error: 'name required', debug: { paramsId: req.params.id, bodyKeys: Object.keys(req.body || {}) } });
  try {
    // req.params.id is the lookup key (UUID for migrated cards, property name for legacy cards).
    // req.body.id is the client's current property.id — passed in slot 19 so updateRow can use
    // values[0] (name) as a third fallback when req.params.id is a UUID not yet in col T.
    const prop = toObj([
      req.body.name, req.body.location, req.body.stage, req.body.dealType,
      req.body.sizeSqFt, req.body.landlord, req.body.rentPsf,
      req.body.totalRentPa, req.body.estRatesPa, req.body.notes,
      req.body.lastContacted ?? '', req.body.brochureUrl ?? '', req.body.mapUrl ?? '',
      req.body.saleLetType ?? '', req.body.capValuePsf ?? '',
      req.body.nextAction ?? '', req.body.nextActionDate ?? '',
      req.body.operatingProfit ?? '', req.body.floorPlanUrl ?? '',
      req.body.id ?? '', // col T slot — may be UUID or name; updateRow normalises it
    ]);
    const resolvedUUID = await updateRow(SHEET, req.params.id, toRow(prop));
    console.log('[PUT] resolvedUUID=', resolvedUUID, '| lookup id=', req.params.id, '| name=', prop.name);
    if (resolvedUUID === null) return res.status(404).json({ error: 'Not found', debug: { lookupId: req.params.id, name: prop.name } });
    res.json({ ...prop, id: resolvedUUID });
  } catch (e) {
    res.status(500).json({ error: errMsg(e) });
  }
});

router.delete('/:id', async (req, res) => {
  const nameHint = typeof req.query.name === 'string' ? req.query.name : undefined;
  console.log('[DELETE] params.id=', JSON.stringify(req.params.id), '| query.name=', JSON.stringify(nameHint));
  try {
    const ok = await deleteRow(SHEET, req.params.id, nameHint);
    console.log('[DELETE] result=', ok, '| id=', req.params.id, '| nameHint=', nameHint);
    ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found', debug: { lookupId: req.params.id, nameHint } });
  } catch (e) {
    res.status(500).json({ error: errMsg(e) });
  }
});

export default router;
