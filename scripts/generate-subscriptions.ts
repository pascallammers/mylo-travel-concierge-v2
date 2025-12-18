import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// Simple CSV parser
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] || '';
    });
    records.push(record);
  }
  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Users without subscriptions (from database query)
const usersWithoutSubs = [
  { id: '1c380298-b550-4e79-b9e7-a4cf08cda9d1', email: 'michifree93@gmail.com' },
  { id: '354a5bed-0322-4ceb-aee1-f192baa4edbc', email: 'polina.albrecht@web.de' },
  { id: '2039412b-e223-4202-8f79-1b4ecbdeade2', email: 'info@biologisches-heilwissen.de' },
  { id: 'ae5baa99-a0e6-4f85-a703-5bb4f4a53f06', email: 'hubi.naef@gmail.com' },
  { id: '9ba464e9-dca0-4d23-9269-cc094e1f7390', email: 'laurischfelix@gmail.com' },
  { id: '24fe62b4-969e-4392-8239-47204eaffd39', email: 'goss_maria@yahoo.de' },
  { id: '3e9d4fd5-b0e1-4d6b-b4da-0e85bb459937', email: 'tinja.ziener@gmail.com' },
  { id: '5ca0b655-9ae4-41ec-8d9b-c4f40014e0c5', email: 'jules.cappuccino@googlemail.com' },
  { id: 'd04285ad-6c53-40dd-8418-7c65c1ccaa24', email: 'michelle.wallrath@gmail.com' },
  { id: '8c349583-8446-4082-b145-81a6c3dbd203', email: 'th.koch@gmx.de' },
  { id: 'f264ea7f-ec6e-4714-9015-65be9894fd80', email: 'jessihildebrand@web.de' },
  { id: '0b386cab-f1ac-4807-9d7e-238dd50a26fc', email: 'zenker@thomas.net' },
  { id: 'c149cb18-8bc0-4300-86e5-7b36bd113782', email: 'janet-ehrentraut@web.de' },
  { id: '406cd738-b829-4e7f-8445-78219a5e477a', email: 'liliana.koller@hotmail.com' },
  { id: 'cbe7d27a-a068-4ef8-87bc-02a2e93a1a7f', email: 'kathi.berger93@gmx.de' },
  { id: '209f58cf-ed1d-4623-8fd7-f98106b88d5f', email: 'ivonne.leon@camcool.de' },
  { id: 'ea65288a-33aa-4708-ba9e-0b7fb3dd9272', email: 'srechs@gmx.de' },
  { id: 'a218fce8-f37c-44d8-87fa-900179073090', email: 'm.knaus@bluedanubemedia.com' },
  { id: 'b7a8808e-fd8a-4b21-b6cb-56879ef0f6cf', email: 'thomas@global-daus.com' },
  { id: '63ecc34e-2200-49ce-a5ee-aa845ed13570', email: 'o.strangfeld80@gmx.ch' },
  { id: '54425e19-ed7d-4dd4-9c03-3d733e8f16f4', email: 'd.jocher@me.com' },
  { id: '889a5bbb-714d-41f1-a4cd-bcf51d14dde8', email: 'info@beyondovermind.com' },
  { id: 'fd0872a7-7317-46c3-87c1-b2802adea4f0', email: 'v.barbieri.ch@gmail.com' },
  { id: '0f03a8e8-f5cc-400d-b69a-c5bc33650915', email: 'miloradstanojevic@hotmail.de' },
  { id: '533b10fc-644a-474d-b37e-b00aa00e5c87', email: 'namikirkici@yahoo.de' },
  { id: '5d9baccd-f230-4501-acc9-c1adf3cab27f', email: 'info@rhs-international.de' },
  { id: '615eedbe-e101-43fe-b6e0-096df546a840', email: 'ingo.kupczyk@t-online.de' },
  { id: '5835798d-ea3b-4112-b994-b2915359d106', email: 'alexander.hochmeister@gmx.at' },
  { id: 'ebea72b3-dd32-4f68-aa40-994fe29fca62', email: 'r.happynessa@gmail.com' },
  { id: '42f311cf-2270-4eec-a1b8-dee21f59e1c4', email: 'bph@hoermann-reisen.de' },
  { id: 'fa7df4a2-603e-47bc-8208-92f6faa33044', email: 'alexanderkathan97@gmail.com' },
  { id: '81078e97-9881-44af-88ef-188ad4125d07', email: 'jonasklose@magenta.de' },
  { id: '706d0a8e-9775-4e58-a38d-685d5148e6b5', email: 'm-schramm.1@gmx.de' },
  { id: '4fea0e00-1184-4356-83bd-4c45d4209847', email: 'kevin.cornelius@gmx.de' },
  { id: '48804c73-ea42-4ac2-91f4-3e4524853efb', email: 'julia@junicornconsulting.com' },
  { id: 'd7f38905-cc0e-4620-8543-f8f872a128b1', email: 'andy@happold.net' },
  { id: '7f8a234e-7457-49cb-90bd-88cd47ea011e', email: 'marcelwaschnewski@outlook.com' },
  { id: '9b1db00f-5c26-49e7-a98c-659b15feddf1', email: 'viktoriama@yahoo.de' },
  { id: 'dba7e5b5-0df5-438b-8c4a-cdd00e90995e', email: 'hello@joerg-schluesselburg.com' },
  { id: '6ea37818-532c-4e2d-9d0b-3e825f6e055f', email: 'seitz.marlen@gmail.com' },
  { id: '102af125-c4b5-497f-b3c1-57b08405860f', email: 'udo.smesovsky@gmail.com' },
  { id: '919e2242-36b3-4a12-ab8d-d5ae02a4d2be', email: 'wscheithauer@t-online.de' },
  { id: '22f39b9c-931b-4b58-b909-0b96574cced9', email: 'steffen_remus@t-online.de' },
  { id: '22f2f6a0-0220-45f9-bf24-eb2d823a1f2c', email: 'jan.sornik@gmx.de' },
  { id: '27a8abc5-8051-4268-8e3c-030ee6aa24c1', email: 'matthias.wiesenfarth@t-online.de' },
  { id: 'd15dce67-87ee-4ba3-bb95-a52efa6af416', email: 'annesiebenkees@icloud.com' },
  { id: '5c5b57d2-8ca1-479f-9461-86fc1367fe60', email: 'kristina.i@live.de' },
  { id: 'e439c7da-64cc-49b7-bfcb-a918ec832760', email: 'gringo.m82@gmail.com' },
  { id: '3a3b1d67-566f-471b-83f4-733ac2ef906b', email: 'roman.wagersreiter@frischgemuese.at' },
  { id: 'e5c71129-63da-49ec-ae72-0e0ed8360e49', email: 'jo-qi@gmx.de' },
  { id: 'c70f5ee6-3193-4e89-8583-3d0fed891955', email: 'gerald.riha@gmail.com' },
  { id: '09f34e50-96a2-42a6-9182-6f0b0a9e554e', email: 'kirsch.kfz@gmx.net' },
  { id: '36cbf901-2196-49b2-a4d5-236d40757e93', email: 'sarah.kofmel@hotmail.com' },
  { id: 'd76f492f-8e97-48dc-adf4-7ee5df1d3d36', email: 'monika.waldeck@itmcg.com' },
  { id: '8205bffc-d9c1-4519-bf71-d04e612da1dd', email: 'cindyschmidt1712@gmail.com' },
  { id: '356ce322-aabf-49af-99fb-d6bda771768a', email: 'andreasneh@aol.com' },
  { id: '61e0cc7a-0767-4122-9927-c876a769ce7c', email: 'galantfahrer@gmail.com' },
  { id: '70d54350-24d5-471d-a8f6-0c884ec04a22', email: 'misch.stephan1@web.de' },
  { id: 'ed27d123-b296-42fe-b08c-f2702168e3ca', email: 'jf@johannes-fetzer.com' },
  { id: 'ba6588ef-a621-4c36-9eea-10ccc2669ff3', email: 'cathrinmeier@gmx.de' },
  { id: '03808fba-6319-4388-8e35-050eb395a5a4', email: 'matthias.leck.ml@gmail.com' },
  { id: 'c429332f-5eae-4f28-add0-c4a103272469', email: 'info@haenschconsulting.com' },
];

interface CsvRow {
  email: string;
  order_date: string;
  order_id: string;
  subscription_id: string;
  total: string;
}

function addOneMonth(dateStr: string): Date {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + 1);
  return date;
}

function generateSubscriptionInserts(): string {
  // Read and parse CSV
  const csvPath = './docs/purchases-ThriveCart Customer Export 2025-12-18 16_30_11.csv';
  const csvContent = readFileSync(csvPath, 'utf-8');
  const records = parseCSV(csvContent) as CsvRow[];

  // Create email to order date map (case-insensitive, take latest order)
  const emailToOrder = new Map<string, CsvRow>();
  for (const record of records) {
    const email = record.email.toLowerCase().trim();
    const existing = emailToOrder.get(email);
    if (!existing || record.order_date > existing.order_date) {
      emailToOrder.set(email, record);
    }
  }

  const subscriptions: string[] = [];
  const now = new Date().toISOString();

  for (const user of usersWithoutSubs) {
    const csvRecord = emailToOrder.get(user.email.toLowerCase());
    if (!csvRecord) {
      console.error(`No CSV record found for email: ${user.email}`);
      continue;
    }

    const orderDate = new Date(csvRecord.order_date + 'T00:00:00Z');
    const endDate = addOneMonth(csvRecord.order_date);
    const subscriptionId = randomUUID();
    const amount = parseInt(csvRecord.total) || 47;

    subscriptions.push(`(
  '${subscriptionId}',
  '${orderDate.toISOString()}',
  '${orderDate.toISOString()}',
  ${amount},
  'EUR',
  'month',
  'active',
  '${orderDate.toISOString()}',
  '${endDate.toISOString()}',
  false,
  '${orderDate.toISOString()}',
  '${endDate.toISOString()}',
  '${user.id}',
  'thrivecart-product-5',
  '${csvRecord.order_id || ''}',
  '${user.id}',
  '${csvRecord.subscription_id || ''}'
)`);
  }

  const sql = `INSERT INTO subscription (
  id,
  "createdAt",
  "modifiedAt",
  amount,
  currency,
  "recurringInterval",
  status,
  "currentPeriodStart",
  "currentPeriodEnd",
  "cancelAtPeriodEnd",
  "startedAt",
  "endsAt",
  "customerId",
  "productId",
  "checkoutId",
  "userId",
  thrivecard_subscription_id
) VALUES
${subscriptions.join(',\n')};`;

  return sql;
}

const sql = generateSubscriptionInserts();
console.log(sql);
