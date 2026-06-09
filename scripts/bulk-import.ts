import 'dotenv/config';
import { appendRow } from '../server/src/sheets';

const SHEET = 'Pipeline';

// Columns: Name | Location | Stage | DealType | SizeSqFt | Landlord | RentPsf | TotalRentPa | EstRatesPa | Notes | LastContacted | BrochureUrl | MapUrl | SaleLetType | CapValuePsf | NextAction | NextActionDate | OperatingProfit
function row(name: string, location: string, size: string, dealType: string, notes: string): string[] {
  return [name, location, 'Dead', dealType, size, '', '', '', '', notes, '', '', '', '', '', '', '', ''];
}

const properties: string[][] = [
  row(
    'Guildford38, 2-3 Dennis Way, Slyfield Industrial Estate, Guildford',
    'Guildford', '37765', 'To Let / For Sale',
    '6.88m clear height. 7 level access doors. 360° circulation. 2 loading yards. LED. EPC D/76. A3 1mi, M25 J10 8mi. £19.50psf. Strike price: £10m / £265 CV psf',
  ),
  row(
    'Birchwood Way, Cotes Park Industrial Estate, Somercotes, Alfreton',
    'Alfreton', '69582', 'To Let / For Sale',
    'Freehold VP. Steel portal frame. 2.53 acres. A38 direct, J28 M1. Launched Apr 2026. Price TBC',
  ),
  row(
    'Panattoni Park Burgess Hill, Cuckfield Road, Burgess Hill',
    'Burgess Hill', '54819', 'To Let / For Sale',
    'Available Now. To Let / For Sale. 8,142–47,408 sq ft. Up to 12.5m eaves. 1mi A23, 9.4mi M23',
  ),
  row(
    '20 Lydden Road, London',
    'London', '34514', 'To Let / For Sale',
    'For Sale. Freehold. Strike £11m / £319 CV psf',
  ),
  row(
    'Arrow Point Beckton, Claps Gate Lane, London',
    'London', '37148', 'To Let / For Sale',
    'Available Now. To Let / For Sale. 37,148 sq ft. Grade A BREEAM Excellent. £25 psf',
  ),
  row(
    'M Dolphin Park Unit 5, Cremers Road, Sittingbourne',
    'Sittingbourne', '31952', 'To Let / For Sale',
    'To Let / For Sale. 31,952 sq ft. Strike price: £5.7m / £178.39 CV psf',
  ),
  row(
    'Aycliffe House, Corby',
    'Corby', '34079', 'To Let / For Sale',
    '10–12m eaves, rents typically c.£9–£11 psf, around 10–15 mins (5–7 miles) from David Lloyd Corby',
  ),
  row(
    '620 Europa Boulevard, Warrington',
    'Warrington', '44351', 'To Let / For Sale',
    '10–12m eaves, rents typically c.£9–£11 psf, around 10–15 mins (5–7 miles) from David Lloyd Warrington',
  ),
  row(
    'Unit 7, Parkgate Industrial Estate, Knutsford',
    'Knutsford', '49880', 'To Let / For Sale',
    '10–12m eaves, rents typically c.£10–£12 psf, around 10–15 mins (4–6 miles) from David Lloyd Cheshire Oaks',
  ),
  row(
    'Logistics City Sharston, Manchester',
    'Manchester', '34584', 'To Let / For Sale',
    '10–12m eaves, rents typically c.£12–£15 psf, around 8–12 mins (3–5 miles) from David Lloyd Manchester Cheadle',
  ),
  row(
    'Nuneaton 37',
    'Nuneaton', '36872', 'To Let / For Sale',
    '10–12m eaves, rents typically c.£9–£11 psf, around 10–15 mins (5–7 miles) from David Lloyd Nuneaton',
  ),
  row(
    'Cosford Lane, Rugby',
    'Rugby', '52499', 'To Let / For Sale',
    '10–12m eaves, rents typically c.£9–£11 psf, around 8–12 mins (4–6 miles) from David Lloyd Rugby',
  ),
  row(
    '9C Andover Business Park, Andover',
    'Andover', '39340', 'To Let / For Sale',
    '10–12m eaves, typical rents c.£11–£13 psf, around 10–15 mins (5–7 miles) from David Lloyd Andover',
  ),
  row(
    'Esprit Irlam',
    'Irlam', '40638', 'To Let / For Sale',
    '12m eaves, rents typically c.£9–£11 psf, around 15–20 mins (6–8 miles) from David Lloyd Manchester Trafford',
  ),
  row(
    'Buckingham 40, Osier Way, Buckingham, Buckinghamshire',
    'Buckingham', '40623', 'To Let / For Sale',
    'Strike £9.150m / £259 CV psf',
  ),
  row(
    'Barberry Midbox 50 Viggan Way, Ansty Park, Coventry',
    'Coventry', '50750', 'To Let / For Sale',
    '10–12m eaves, rents typically c.£10–£12 psf, around 15–20 mins (8–10 miles) from David Lloyd Coventry',
  ),
  row(
    'High Bay 42, 12 Stilebrook Road, Olney',
    'Olney', '42660', 'To Let / For Sale',
    '12m eaves in the high-bay section. Approx. 15–18 mins (10–11 miles) from David Lloyd Milton Keynes',
  ),
  row(
    'Momentum Rainham, Units 1-4, Rainham',
    'Rainham', '41126', 'To Let / For Sale',
    'To Let / For Sale. Grade A. 20 acres. A13 3mi, M25 J31 7.3mi',
  ),
  row(
    'Unit 1 Tungsten Park, Milton Keynes',
    'Milton Keynes', '46950', 'To Let / For Sale',
    '10m eaves, c.£13–£15 psf rent, approx. 10–12 mins (3–4 miles) from David Lloyd Milton Keynes',
  ),
  row(
    'Air 66, Stirling Road, Speke, Liverpool',
    'Liverpool', '67530', 'To Let / For Sale',
    'Near David Lloyd Speke (3–5 mins). £9.50–£11.50 psf rent. High ESG spec',
  ),
  row(
    'Jade Business Park, Murton',
    'Murton', '85000', 'Design & Build',
    '31,000–85,000 sq ft range, D&B options. 8–12 min from David Lloyd Sunderland. Strong North East industrial corridor on A19',
  ),
  row(
    'Voltage Park, Manchester',
    'Manchester', '62000', 'To Let / For Sale',
    '10–15 min from David Lloyd Manchester Trafford',
  ),
  row(
    'Suffolk Park (SP77), Bury St Edmunds',
    'Bury St Edmunds', '78000', 'Design & Build',
    'D&B, planning consent granted. 8–10 min from David Lloyd Bury St Edmunds',
  ),
  row(
    'Manor Royal Business District, Crawley',
    'Crawley', '65620', 'To Let / For Sale',
    'High CV psf due to strong south east location. Under 10 mins from David Lloyd Crawley',
  ),
];

async function main() {
  console.log(`Importing ${properties.length} properties to "${SHEET}" sheet…`);
  for (let i = 0; i < properties.length; i++) {
    const name = properties[i][0];
    try {
      await appendRow(SHEET, properties[i]);
      console.log(`  [${i + 1}/${properties.length}] ✓ ${name}`);
    } catch (err) {
      console.error(`  [${i + 1}/${properties.length}] ✗ ${name}:`, err);
      process.exit(1);
    }
  }
  console.log('\nDone — all rows appended.');
}

main().catch(err => { console.error(err); process.exit(1); });
