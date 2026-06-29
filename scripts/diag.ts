import 'dotenv/config';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

async function main() {
  console.log('SPREADSHEET_ID:', SPREADSHEET_ID || '(NOT SET)');
  console.log('EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '(NOT SET)');
  const keyRaw = process.env.GOOGLE_PRIVATE_KEY ?? '';
  const key = keyRaw.replace(/\\n/g, '\n');
  console.log('KEY prefix:', key.slice(0, 40) || '(NOT SET)');

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const ss = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tabs = ss.data.sheets?.map(s => `"${s.properties?.title}"`) ?? [];
  console.log('\nSheet tabs:', tabs.join(', '));

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pipeline!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const all = res.data.values ?? [];
  const rows = all.slice(1);
  console.log(`\nPipeline: ${rows.length} data rows`);
  console.log('Header:', all[0]);
  console.log('\nFirst 5 rows (name | stage | col-T):');
  rows.slice(0, 5).forEach((r, i) => {
    console.log(`  [${i+2}] "${r[0]}" | "${r[2]}" | uuid="${r[19] ?? ''}" | len=${r.length}`);
  });

  // Test append
  const testName = '__DIAG_' + Date.now();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pipeline!A:Z',
    valueInputOption: 'RAW',
    requestBody: { values: [[testName, '', 'Identified', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'diag-uuid']] },
  });
  console.log('\n✓ Append succeeded');

  const res2 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pipeline!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows2 = (res2.data.values ?? []).slice(1);
  const foundIdx = rows2.findIndex(r => r[0] === testName);
  const found = rows2[foundIdx];
  console.log('Read-back:', found ? `✓ FOUND at row ${foundIdx+2} col-T="${found[19]}"` : '✗ NOT FOUND');

  // Test update
  if (foundIdx !== -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Pipeline!A${foundIdx+2}:Z${foundIdx+2}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[testName + '_UPDATED', '', 'Brochure Sent', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'diag-uuid']] },
    });
    console.log('✓ Update succeeded');
  }

  // Cleanup
  const sheetId = ss.data.sheets?.find(s => s.properties?.title === 'Pipeline')?.properties?.sheetId ?? 0;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: foundIdx+1, endIndex: foundIdx+2 } } }] },
  });
  console.log('✓ Delete succeeded — cleanup done');
  console.log('\n=== All operations (read, append, update, delete) work with local credentials ===');
}

main().catch(e => {
  console.error('\n✗ FAILED:', e.message);
  if (e.response?.data) console.error('Google error:', JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
