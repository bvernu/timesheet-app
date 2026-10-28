// A small, dependency-free writer for real Excel (.xlsx) files.
//
//   downloadXlsx('timesheets.xlsx', [
//     {
//       name: 'Timesheets',
//       columns: [{ header: 'Employee', width: 22 }, { header: 'Date', width: 13, style: 'date' }, ...],
//       rows: [['Eve', new Date(), ...], ...],     // Date -> real date/time cell, number -> number, string -> text, null -> empty
//       totals: { label: 'Total', sum: [5, 6] },   // optional: a SUM row under the data for these column indexes
//     },
//   ]);
//
// Column styles: 'date', 'datetime', 'hours' (0.00), 'distance' (0.0), 'count' (0), 'wrap' (text that wraps), or omitted (text).

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const encoder = new TextEncoder();

// ---------- cell styles (indexes into the cellXfs list in styles.xml) ----------
const STYLE_INDEX = {
  text: 0,
  header: 1,
  date: 2,
  datetime: 3,
  hours: 4,
  distance: 5,
  count: 6,
  wrap: 7,
  totalLabel: 8,
  totalHours: 9,
  totalDistance: 10,
  totalCount: 11,
};
const TOTAL_STYLE_FOR = { hours: 'totalHours', distance: 'totalDistance', count: 'totalCount' };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd h:mm AM/PM"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F4F7"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD0D5DD"/></bottom><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF98A2B3"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="top"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="top"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="2" fontId="1" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="166" fontId="1" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="1" fontId="1" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// ---------- helpers ----------
const escapeXml = (value) =>
  String(value)
    // characters that are not allowed in XML 1.0 at all
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const columnLetter = (index) => {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

// Excel stores dates as "days since 1899-12-30". The wall-clock time the person sees is what is stored,
// with no time-zone conversion, so a 5:00 PM entry opens as 5:00 PM in Excel.
const toExcelSerial = (d) =>
  (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - Date.UTC(1899, 11, 30)) /
  86400000;

const safeSheetName = (name, used) => {
  let base = String(name).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

function cellXml(ref, value, styleName) {
  const s = STYLE_INDEX[styleName] ?? 0;
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `<c r="${ref}" s="${s}"><v>${toExcelSerial(value)}</v></c>`;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `<c r="${ref}" s="${s}"><v>${value}</v></c>` : '';
  }
  // Text is stored as plain text, so Excel never treats something a person typed (like "=1+1") as a formula.
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(sheet) {
  const { columns, rows, totals } = sheet;
  const lastCol = columnLetter(columns.length - 1);
  const lastDataRow = rows.length + 1; // header is row 1

  const colsXml = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`)
    .join('');

  const out = [];
  // header row
  out.push(
    `<row r="1" ht="22" customHeight="1">${columns
      .map((c, i) => `<c r="${columnLetter(i)}1" s="${STYLE_INDEX.header}" t="inlineStr"><is><t>${escapeXml(c.header)}</t></is></c>`)
      .join('')}</row>`
  );
  // data rows
  rows.forEach((row, r) => {
    const rowNumber = r + 2;
    const cells = columns.map((c, i) => cellXml(`${columnLetter(i)}${rowNumber}`, row[i], c.style || 'text')).join('');
    out.push(`<row r="${rowNumber}">${cells}</row>`);
  });
  // optional totals row, separated from the data by one blank row so filters and sorting never include it
  if (totals && rows.length > 0) {
    const totalRow = lastDataRow + 2;
    const cells = [`<c r="A${totalRow}" s="${STYLE_INDEX.totalLabel}" t="inlineStr"><is><t>${escapeXml(totals.label || 'Total')}</t></is></c>`];
    columns.forEach((c, i) => {
      if (i === 0) return;
      const letter = columnLetter(i);
      if (totals.sum.includes(i)) {
        const cached = rows.reduce((sum, row) => sum + (typeof row[i] === 'number' ? row[i] : 0), 0);
        const style = STYLE_INDEX[TOTAL_STYLE_FOR[c.style] || 'totalLabel'];
        cells.push(`<c r="${letter}${totalRow}" s="${style}"><f>SUM(${letter}2:${letter}${lastDataRow})</f><v>${cached}</v></c>`);
      } else {
        cells.push(`<c r="${letter}${totalRow}" s="${STYLE_INDEX.totalLabel}"/>`);
      }
    });
    out.push(`<row r="${totalRow}">${cells.join('')}</row>`);
  }

  const filter = rows.length > 0 ? `<autoFilter ref="A1:${lastCol}${lastDataRow}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${colsXml}</cols><sheetData>${out.join('')}</sheetData>${filter}</worksheet>`;
}

// ---------- zip (store only, no compression) ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function zipFiles(files) {
  const DOS_TIME = 0;
  const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1; // 2020-01-01
  const parts = [];
  const central = [];
  let offset = 0;

  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    parts.push(local, data);

    const entry = new Uint8Array(46 + name.length);
    const ev = new DataView(entry.buffer);
    ev.setUint32(0, 0x02014b50, true);
    ev.setUint16(4, 20, true);
    ev.setUint16(6, 20, true);
    ev.setUint16(8, 0x0800, true);
    ev.setUint16(10, 0, true);
    ev.setUint16(12, DOS_TIME, true);
    ev.setUint16(14, DOS_DATE, true);
    ev.setUint32(16, crc, true);
    ev.setUint32(20, data.length, true);
    ev.setUint32(24, data.length, true);
    ev.setUint16(28, name.length, true);
    ev.setUint32(42, offset, true);
    entry.set(name, 46);
    central.push(entry);

    offset += local.length + data.length;
  });

  const centralSize = central.reduce((n, e) => n + e.length, 0);
  const end = new Uint8Array(22);
  const dv = new DataView(end.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(8, files.length, true);
  dv.setUint16(10, files.length, true);
  dv.setUint32(12, centralSize, true);
  dv.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: XLSX_MIME });
}

// ---------- public API ----------
export function buildXlsx(sheets) {
  const used = new Set();
  const names = sheets.map((s) => safeSheetName(s.name, used));
  const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${NS_REL}"><bookViews><workbookView/></bookViews><sheets>${names
        .map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets><definedNames>${sheets
        .map((s, i) =>
          s.rows.length > 0
            ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${names[i].replace(/'/g, "''")}'!$A$1:$${columnLetter(s.columns.length - 1)}$${s.rows.length + 1}</definedName>`
            : ''
        )
        .join('')}</definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${sheets.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: 'xl/styles.xml', content: STYLES_XML },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: sheetXml(s) })),
  ];

  return zipFiles(files);
}

export function downloadXlsx(filename, sheets) {
  const blob = buildXlsx(sheets);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
