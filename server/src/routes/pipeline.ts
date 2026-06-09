import { Router } from 'express';
import { readRows, appendRow, updateRow, deleteRow } from '../sheets';

const router = Router();
const SHEET = 'Pipeline';

// Sheet columns: A=Name | B=Location | C=Stage | D=DealType | E=SizeSqFt | F=Landlord | G=RentPsf | H=TotalRentPa | I=EstRatesPa | J=Notes | K=LastContacted | L=BrochureUrl | M=MapUrl | N=SaleLetType | O=CapValuePsf | P=NextAction | Q=NextActionDate
// No separate ID column — property name (col A) is the unique identifier
const toObj = (r: string[]) => ({
  id:             r[0] || '',
  name:           r[0] || '',
  location:       r[1] || '',
  stage:          r[2] || 'Identified',
  dealType:       r[3] || '',
  sizeSqFt:       r[4] || '',
  landlord:       r[5] || '',
  rentPsf:        r[6] || '',
  totalRentPa:    r[7] || '',
  estRatesPa:     r[8] || '',
  notes:          r[9] || '',
  lastContacted:  r[10] || '',
  brochureUrl:    r[11] || '',
  mapUrl:         r[12] || '',
  saleLetType:    r[13] || '',
  capValuePsf:    r[14] || '',
  nextAction:     r[15] || '',
  nextActionDate: r[16] || '',
});

const toRow = (p: ReturnType<typeof toObj>) => [
  p.name, p.location, p.stage, p.dealType, p.sizeSqFt,
  p.landlord, p.rentPsf, p.totalRentPa, p.estRatesPa, p.notes,
  p.lastContacted, p.brochureUrl, p.mapUrl, p.saleLetType, p.capValuePsf,
  p.nextAction, p.nextActionDate,
];

router.get('/', async (_req, res) => {
  try {
    const rows = await readRows(SHEET);
    res.json(rows.filter(r => r[0]).map(toObj));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/', async (req, res) => {
  try {
    const prop = toObj([
      req.body.name, req.body.location, req.body.stage, req.body.dealType,
      req.body.sizeSqFt, req.body.landlord, req.body.rentPsf,
      req.body.totalRentPa, req.body.estRatesPa, req.body.notes,
      req.body.lastContacted ?? '', req.body.brochureUrl ?? '', req.body.mapUrl ?? '',
      req.body.saleLetType ?? '', req.body.capValuePsf ?? '',
      req.body.nextAction ?? '', req.body.nextActionDate ?? '',
    ]);
    await appendRow(SHEET, toRow(prop));
    res.json(prop);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const prop = toObj([
      req.body.name, req.body.location, req.body.stage, req.body.dealType,
      req.body.sizeSqFt, req.body.landlord, req.body.rentPsf,
      req.body.totalRentPa, req.body.estRatesPa, req.body.notes,
      req.body.lastContacted ?? '', req.body.brochureUrl ?? '', req.body.mapUrl ?? '',
      req.body.saleLetType ?? '', req.body.capValuePsf ?? '',
      req.body.nextAction ?? '', req.body.nextActionDate ?? '',
    ]);
    const ok = await updateRow(SHEET, decodeURIComponent(req.params.id), toRow(prop));
    ok ? res.json(prop) : res.status(404).json({ error: 'Not found' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const ok = await deleteRow(SHEET, decodeURIComponent(req.params.id));
    ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
