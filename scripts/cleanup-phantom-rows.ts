/**
 * Removes rows with empty col A from the Pipeline sheet.
 * These are phantom rows from previous debugging that extend the sheet's
 * "table end" and can cause appends to land in unexpected positions.
 */
import 'dotenv/config';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

async function main() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pipeline!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const all = res.data.values ?? [];
  console.log(`Total rows in sheet: ${all.length} (including header)`);

  // Find rows with empty col A (skip header at index 0)
  const phantomIndices = all
    .map((r, i) => ({ i, name: r[0] }))
    .filter(({ i, name }) => i > 0 && (!name || String(name).trim() === ''))
    .map(({ i }) => i);

  console.log(`Phantom rows (empty col A): ${phantomIndices.length} at sheet indices [${phantomIndices.join(', ')}]`);

  if (phantomIndices.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  // Print what we're removing
  phantomIndices.forEach(i => {
    const r = all[i];
    console.log(`  [${i + 1}] col-B="${r[1] ?? ''}" col-T="${r[19] ?? ''}" len=${r.length}`);
  });

  const ss = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const pipelineSheetId = ss.data.sheets?.find(s => s.properties?.title === 'Pipeline')?.properties?.sheetId!;

  // Delete from bottom to top so indices don't shift
  for (const idx of [...phantomIndices].reverse()) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: pipelineSheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 },
          },
        }],
      },
    });
    console.log(`  Deleted row at index ${idx} (sheet row ${idx + 1})`);
  }

  // Verify
  const res2 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pipeline!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const final = res2.data.values ?? [];
  const remainingPhantoms = final.slice(1).filter(r => !r[0] || String(r[0]).trim() === '');
  console.log(`\nAfter cleanup: ${final.length} rows (${final.length - 1} data rows), ${remainingPhantoms.length} phantom rows remaining`);
}

main().catch(e => {
  console.error('Error:', e.message);
  if (e.response?.data) console.error('Google error:', JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
