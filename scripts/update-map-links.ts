import 'dotenv/config';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SHEET = 'Pipeline';

// Column M (0-based index 12) = mapUrl
const MAP_COL = 'M';

const MAP_LINKS: Record<string, string> = {
  'Guildford38, 2-3 Dennis Way, Slyfield Industrial Estate, Guildford':
    'https://www.google.com/maps/search/?api=1&query=2-3+Dennis+Way+Slyfield+Industrial+Estate+Guildford+GU1+1AF',
  'Birchwood Way, Cotes Park Industrial Estate, Somercotes, Alfreton':
    'https://www.google.com/maps/search/?api=1&query=Birchwood+Way+Cotes+Park+Industrial+Estate+Somercotes+Alfreton+DE55+4QJ',
  'Panattoni Park Burgess Hill, Cuckfield Road, Burgess Hill':
    'https://www.google.com/maps/search/?api=1&query=Cuckfield+Road+Burgess+Hill+BN6+8JR',
  '20 Lydden Road, London':
    'https://www.google.com/maps/search/?api=1&query=20+Lydden+Road+London+SW18+4LT',
  'Arrow Point Beckton, Claps Gate Lane, London':
    'https://www.google.com/maps/search/?api=1&query=Claps+Gate+Lane+Beckton+London+E6+6LH',
  'M Dolphin Park Unit 5, Cremers Road, Sittingbourne':
    'https://www.google.com/maps/search/?api=1&query=Cremers+Road+Sittingbourne+ME10+3HH',
  'Aycliffe House, Corby':
    'https://www.google.com/maps/search/?api=1&query=Aycliffe+House+Corby+NN17+1QE',
  '620 Europa Boulevard, Warrington':
    'https://www.google.com/maps/search/?api=1&query=620+Europa+Boulevard+Warrington+WA5+7TX',
  'Unit 7, Parkgate Industrial Estate, Knutsford':
    'https://www.google.com/maps/search/?api=1&query=Parkgate+Industrial+Estate+Knutsford+WA16+8DX',
  'Logistics City Sharston, Manchester':
    'https://www.google.com/maps/search/?api=1&query=Logistics+City+Sharston+Manchester+M22+4RA',
  'Nuneaton 37':
    'https://www.google.com/maps/search/?api=1&query=Nuneaton+CV10+7RW',
  'Cosford Lane, Rugby':
    'https://www.google.com/maps/search/?api=1&query=Cosford+Lane+Rugby+CV21+1QN',
  '9C Andover Business Park, Andover':
    'https://www.google.com/maps/search/?api=1&query=Andover+Business+Park+Andover+SP11+8BF',
  'Esprit Irlam':
    'https://www.google.com/maps/search/?api=1&query=Esprit+Irlam+M44+5BP',
  'Buckingham 40, Osier Way, Buckingham, Buckinghamshire':
    'https://www.google.com/maps/search/?api=1&query=Osier+Way+Buckingham+MK18+1TB',
  'Barberry Midbox 50 Viggan Way, Ansty Park, Coventry':
    'https://www.google.com/maps/search/?api=1&query=Viggan+Way+Ansty+Park+Coventry+CV7+9RD',
  'High Bay 42, 12 Stilebrook Road, Olney':
    'https://www.google.com/maps/search/?api=1&query=12+Stilebrook+Road+Olney+MK46+5EA',
  'Momentum Rainham, Units 1-4, Rainham':
    'https://www.google.com/maps/search/?api=1&query=Momentum+Rainham+RM13+9PG',
  'Unit 1 Tungsten Park, Milton Keynes':
    'https://www.google.com/maps/search/?api=1&query=Tungsten+Park+Milton+Keynes+MK14+6ES',
  'Air 66, Stirling Road, Speke, Liverpool':
    'https://www.google.com/maps/search/?api=1&query=66+Stirling+Road+Speke+Liverpool+L24+1YL',
  'Jade Business Park, Murton':
    'https://www.google.com/maps/search/?api=1&query=Jade+Business+Park+Murton+SR7+9TT',
  'Voltage Park, Manchester':
    'https://www.google.com/maps/search/?api=1&query=Voltage+Park+Manchester+M31',
  'Suffolk Park (SP77), Bury St Edmunds':
    'https://www.google.com/maps/search/?api=1&query=Suffolk+Park+Bury+St+Edmunds+IP32+7FQ',
  'Manor Royal Business District, Crawley':
    'https://www.google.com/maps/search/?api=1&query=Manor+Royal+Business+District+Crawley+RH10+9UH',
};

async function main() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Read all rows once
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET}!A:A`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const names = (readRes.data.values as string[][] | null | undefined) ?? [];

  // Build batch update — one entry per matching row
  const data: { range: string; values: string[][] }[] = [];
  const matched = new Set<string>();

  for (let i = 1; i < names.length; i++) { // row 1 (index 0) is header
    const name = String(names[i]?.[0] ?? '').trim();
    const url = MAP_LINKS[name];
    if (url) {
      const sheetRow = i + 1; // 1-based, header = row 1
      data.push({ range: `${SHEET}!${MAP_COL}${sheetRow}`, values: [[url]] });
      matched.add(name);
      console.log(`  row ${sheetRow}: ${name}`);
    }
  }

  if (data.length === 0) {
    console.log('No matching rows found — check that the bulk-import ran first.');
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  });

  console.log(`\nUpdated ${data.length} cell(s) across ${matched.size} distinct name(s).`);

  const missing = Object.keys(MAP_LINKS).filter(n => !matched.has(n));
  if (missing.length) {
    console.warn('\nNot found in sheet (names may differ):');
    missing.forEach(n => console.warn(`  - ${n}`));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
