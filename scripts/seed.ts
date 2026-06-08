/**
 * One-time seed script — populates Google Sheets with initial pipeline data.
 * Run once after creating your .env file:  npm run seed
 */
import 'dotenv/config';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

function getSheets() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const sheets = getSheets();

async function sheetExists(name: string): Promise<boolean> {
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${name}!A1` });
    return true;
  } catch {
    return false;
  }
}

async function createSheet(name: string): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: name } } }] },
  });
}

async function setHeader(name: string, headers: string[]): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${name}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] },
  });
}

async function appendRow(sheet: string, values: string[]): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:Z`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

async function readRows(sheet: string): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:Z`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const all = (res.data.values as string[][] | null) || [];
  return all.slice(1);
}

async function getConfigValue(key: string): Promise<string | null> {
  const rows = await readRows('Config');
  return rows.find(r => r[0] === key)?.[1] ?? null;
}

async function setConfigValue(key: string, value: string): Promise<void> {
  const rows = await readRows('Config');
  const idx = rows.findIndex(r => r[0] === key);
  if (idx !== -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Config!A${idx + 2}:B${idx + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[key, value]] },
    });
  } else {
    await appendRow('Config', [key, value]);
  }
}

// A=Name | B=Location | C=Stage | D=DealType | E=SizeSqFt | F=Landlord | G=RentPsf | H=TotalRentPa | I=EstRatesPa | J=Notes
const SEED_PROPERTIES: string[][] = [
  ['Tungsten unit', '', 'Identified', 'Lease', '', 'Tungsten', '', '', '',
    'Owner occupy or lease preferred, wants guarantor, relaxed on rent deposit, check court dimensions.'],
  ['Rugby unit', '', 'Identified', 'Lease', '', 'Private vendor', '', '', '',
    'Private vendor sell or lease to strong covenant, financials requested, await third-party capital.'],
  ['Esprit', '', 'Identified', 'Lease', '', '', '13', '', '',
    'Would consider Padel Xtra subject to covenant, check location.'],
  ['Over Business Park', '', 'Under Discussion', 'Design & Build', '', '', '', '', '',
    'Gone to board level, awaiting Knight Frank decision.'],
  ['Totalpark', '', 'Dead', 'Lease', '', '', '', '', '',
    'Two-year rent deposit required, set aside.'],
];

async function main() {
  if (!SPREADSHEET_ID) {
    console.error('GOOGLE_SPREADSHEET_ID is not set. Create a .env file from .env.example.');
    process.exit(1);
  }

  // ── Pipeline sheet ──
  console.log('Setting up Pipeline sheet...');
  if (!(await sheetExists('Pipeline'))) {
    await createSheet('Pipeline');
    console.log('  Created Pipeline sheet.');
  }
  await setHeader('Pipeline', [
    'Property Name', 'Location', 'Stage', 'Deal Type', 'Size (sq ft)',
    'Landlord/Vendor', 'Rent psf (£)', 'Total rent pa (£)', 'Est. rates pa (£)', 'Notes',
  ]);

  const existingRows = (await readRows('Pipeline')).filter(r => r[0]);
  if (existingRows.length > 0) {
    console.log(`  Pipeline already has ${existingRows.length} row(s) — skipping property seed.`);
  } else {
    console.log('  Seeding 5 initial properties...');
    for (const row of SEED_PROPERTIES) {
      await appendRow('Pipeline', row);
      console.log(`    + ${row[0]}`);
    }
  }

  // ── Config sheet ──
  console.log('Setting up Config sheet...');
  if (!(await sheetExists('Config'))) {
    await createSheet('Config');
    await setHeader('Config', ['Key', 'Value']);
    console.log('  Created Config sheet.');
  }

  const locValue = await getConfigValue('targetLocations');
  if (!locValue) {
    await setConfigValue('targetLocations', JSON.stringify(['Worcester', 'Cambridge']));
    console.log('  Set target locations: Worcester, Cambridge.');
  } else {
    console.log('  Target locations already set.');
  }

  console.log('\nSeed complete!');
}

main().catch(err => {
  console.error('Seed failed:', err.message ?? err);
  process.exit(1);
});
