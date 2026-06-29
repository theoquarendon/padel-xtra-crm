/**
 * Repair + extended diagnostic.
 * 1. Shows the FULL current state of the Pipeline sheet (to find the orphaned test row and missing header)
 * 2. Restores the header row if missing
 * 3. Removes any leftover __DIAG__ rows
 * 4. Tests append with a NARROW range and confirms where data actually lands
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

  // ── 1. Full state dump ──────────────────────────────────────────────────────
  console.log('=== CURRENT SHEET STATE ===');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pipeline!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const allRows = res.data.values ?? [];
  console.log(`Total rows returned by API: ${allRows.length}`);
  console.log('Row 1 (what code thinks is the header):', allRows[0]?.slice(0, 5));
  console.log('Row 2:', allRows[1]?.slice(0, 3));
  console.log('Last 3 rows:');
  allRows.slice(-3).forEach((r, i) => {
    const sheetRowNum = allRows.length - 3 + i + 1;
    console.log(`  [${sheetRowNum}] "${r[0]}" | "${r[2] ?? ''}" | uuid="${r[19] ?? ''}" | len=${r.length}`);
  });

  // Check if header is missing
  const firstRow = allRows[0] ?? [];
  const hasHeader = firstRow[0] === 'Property Name';
  console.log('\nHeader row present?', hasHeader ? '✓ YES' : '✗ NO — header was deleted!');

  // Find any diagnostic test rows
  const diagRowIndices = allRows.map((r, i) => r[0]?.startsWith?.('__DIAG_') ? i : -1).filter(i => i >= 0);
  console.log('Orphaned __DIAG__ rows at indices:', diagRowIndices.length ? diagRowIndices : 'none');

  // ── 2. Restore header if missing ────────────────────────────────────────────
  const ss = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const pipelineSheetId = ss.data.sheets?.find(s => s.properties?.title === 'Pipeline')?.properties?.sheetId!;

  if (!hasHeader) {
    console.log('\nRestoring header row...');
    // Insert a blank row at position 0 (before row 1)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          insertDimension: {
            range: { sheetId: pipelineSheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
            inheritFromBefore: false,
          },
        }],
      },
    });
    // Write the header
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pipeline!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['Property Name', 'Location', 'Stage', 'Deal Type', 'Size (sq ft)',
          'Landlord/Vendor', 'Rent psf (£)', 'Total rent pa (£)', 'Est. rates pa (£)', 'Notes',
          'Last Contacted', 'Brochure URL', 'Map URL', 'Sale/Let Type', 'Cap Value psf',
          'Next Action', 'Next Action Date', 'Operating Profit', 'Floor Plan URL', 'ID (UUID)']],
      },
    });
    console.log('✓ Header restored');
  }

  // ── 3. Remove __DIAG__ rows ─────────────────────────────────────────────────
  if (diagRowIndices.length > 0) {
    // Read again to get current state after potential header restore
    const res3 = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pipeline!A:Z',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const currentRows = res3.data.values ?? [];
    const diagIndices2 = currentRows.map((r, i) => r[0]?.startsWith?.('__DIAG_') ? i : -1).filter(i => i >= 0);

    for (const idx of diagIndices2.reverse()) { // delete from bottom up
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
      console.log(`✓ Removed __DIAG__ row at index ${idx}`);
    }
  }

  // ── 4. Re-read to confirm clean state ───────────────────────────────────────
  const resFinal = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pipeline!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const finalRows = resFinal.data.values ?? [];
  const dataRows = finalRows.slice(1);
  console.log(`\n=== AFTER REPAIR ===`);
  console.log(`Header: "${finalRows[0]?.[0]}" (expected "Property Name")`);
  console.log(`Data rows: ${dataRows.length}`);
  console.log('First row:', dataRows[0]?.[0], '|', dataRows[0]?.[2]);

  // ── 5. Diagnose WHERE append actually writes ─────────────────────────────────
  console.log('\n=== APPEND LOCATION DIAGNOSTIC ===');
  // First read end-of-table
  const resCheck = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pipeline!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  console.log(`Before append: ${(resCheck.data.values ?? []).length} total rows in A:Z`);

  const testName = '__DIAG2_' + Date.now();
  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pipeline!A:Z',
    valueInputOption: 'RAW',
    requestBody: { values: [[testName, 'TestLocation', 'Identified']] },
  });
  // The append response tells us EXACTLY where it wrote
  const updatedRange = (appendRes.data as any).updates?.updatedRange ?? 'unknown';
  console.log('Append response says it wrote to:', updatedRange);

  // Read back
  const resAfter = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pipeline!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const afterRows = resAfter.data.values ?? [];
  console.log(`After append: ${afterRows.length} total rows in A:Z`);
  const foundIdx2 = afterRows.findIndex(r => r[0] === testName);
  console.log(`Test row found at index: ${foundIdx2} (${foundIdx2 === -1 ? 'NOT FOUND — bug confirmed!' : 'found at row ' + (foundIdx2 + 1)})`);

  // Clean up test row (only if found)
  if (foundIdx2 >= 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: pipelineSheetId, dimension: 'ROWS', startIndex: foundIdx2, endIndex: foundIdx2 + 1 },
          },
        }],
      },
    });
    console.log('✓ Test row cleaned up');
  } else {
    console.log('WARNING: Test row not found — will remain in sheet. Check the updatedRange above to find it manually.');
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

main().catch(e => {
  console.error('\n✗ SCRIPT ERROR:', e.message);
  if (e.response?.data) console.error('Google API detail:', JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
