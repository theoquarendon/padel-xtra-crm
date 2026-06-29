import { randomUUID } from 'crypto';
import { Router } from 'express';
import { readRows, appendRow, updateRow, deleteRow } from '../sheets';

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
      req.body.operatingProfit ?? '', req.body.floorPlanUrl ?? '',
      randomUUID(), // col T: generate stable UUID on creation
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
      req.body.operatingProfit ?? '', req.body.floorPlanUrl ?? '',
      req.body.id ?? '', // col T: UUID from client (may be name for legacy rows)
    ]);
    const resolvedUUID = await updateRow(SHEET, req.params.id, toRow(prop));
    if (resolvedUUID === null) return res.status(404).json({ error: 'Not found' });
    // Always return the stable UUID as the id so the client can update its reference
    res.json({ ...prop, id: resolvedUUID });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const ok = await deleteRow(SHEET, req.params.id);
    ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
