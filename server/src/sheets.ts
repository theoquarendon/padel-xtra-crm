import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

let _sheets: ReturnType<typeof google.sheets> | null = null;

function getSheets() {
  if (!_sheets) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    _sheets = google.sheets({ version: 'v4', auth });
  }
  return _sheets;
}

export async function readRows(sheetName: string): Promise<string[][]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const all = (res.data.values as string[][] | null | undefined) || [];
  return all.slice(1); // skip header row
}

export async function appendRow(sheetName: string, values: string[]): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

export async function updateRow(sheetName: string, id: string, values: string[]): Promise<boolean> {
  const sheets = getSheets();
  const rows = await readRows(sheetName);
  const rowIndex = rows.findIndex(r => String(r[0]).trim() === String(id).trim());
  if (rowIndex === -1) return false;
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${sheetRow}:Z${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
  return true;
}

export async function deleteRow(sheetName: string, id: string): Promise<boolean> {
  const sheets = getSheets();
  const rows = await readRows(sheetName);
  const rowIndex = rows.findIndex(r => String(r[0]).trim() === String(id).trim());
  if (rowIndex === -1) return false;

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex + 1,
            endIndex: rowIndex + 2,
          },
        },
      }],
    },
  });
  return true;
}

export async function ensureSheet(sheetName: string): Promise<void> {
  const sheets = getSheets();
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
    });
  } catch {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:B1`,
        valueInputOption: 'RAW',
        requestBody: { values: [['Key', 'Value']] },
      });
    } catch { /* concurrent create or already exists */ }
  }
}

export async function getConfigValue(key: string): Promise<string | null> {
  try {
    const rows = await readRows('Config');
    const row = rows.find(r => r[0] === key);
    return row?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  await ensureSheet('Config');
  const updated = await updateRow('Config', key, [key, value]);
  if (!updated) {
    await appendRow('Config', [key, value]);
  }
}
