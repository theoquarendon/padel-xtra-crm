import 'dotenv/config';
import { appendRow, readRows } from '../server/src/sheets';

async function main() {
  const before = await readRows('Pipeline');
  console.log('Rows before:', before.length);

  await appendRow('Pipeline', [
    '9C Andover Business Park, Andover',
    'Andover',
    'Dead',
    'To Let / For Sale',
    '39340',
    '', '', '', '',
    '10–12m eaves, typical rents c.£11–£13 psf, around 10–15 mins (5–7 miles) from David Lloyd Andover',
    '', '',
    'https://www.google.com/maps/search/?api=1&query=Andover+Business+Park+Andover+SP11+8BF',
    '', '', '', '', '',
  ]);

  const after = await readRows('Pipeline');
  const added = after.find(r => r[0] === '9C Andover Business Park, Andover' && r[2] === 'Dead');
  console.log('Rows after:', after.length);
  console.log('Added row:', added ? `✓ mapUrl=${added[12]}` : '✗ not found');
}

main().catch(err => { console.error(err); process.exit(1); });
