/**
 * Office exports built on the device: Excel (.xlsx) tables from recognised text, and
 * PowerPoint (.pptx) decks with one page image per slide. Both open in Microsoft Office,
 * Google Docs/Sheets/Slides and WPS.
 */
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strToU8, zipSync } from 'fflate';

import { getImageSizeFromUri } from './documentScan';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const escapeXml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const safeName = (title: string, fallback: string) => title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || fallback;

async function writeAndShare(bytes: Uint8Array, fileName: string, mimeType: string) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
}

// ---------------------------------------------------------------------------
// Tables from a page image
// ---------------------------------------------------------------------------

type Line = { text: string; left: number; top: number; width: number; height: number };

/**
 * Rebuilds a table from the text lines on a page: lines at the same height form a row;
 * the left edges of lines, clustered across the page, form the columns.
 */
export function linesToTable(lines: Line[]): string[][] {
  if (lines.length === 0) return [];
  const heights = lines.map((l) => l.height).sort((a, b) => a - b);
  const lineH = heights[Math.floor(heights.length / 2)] || 10;

  // Rows: by vertical centre.
  const sorted = [...lines].sort((a, b) => a.top + a.height / 2 - (b.top + b.height / 2));
  const rows: Line[][] = [];
  for (const line of sorted) {
    const cy = line.top + line.height / 2;
    const row = rows[rows.length - 1];
    const rowCy = row ? row.reduce((s, l) => s + l.top + l.height / 2, 0) / row.length : -Infinity;
    if (row && Math.abs(cy - rowCy) < lineH * 0.6) row.push(line);
    else rows.push([line]);
  }

  // Columns: cluster left edges; a jump between neighbouring edges wider than ~1.2 line
  // heights starts a new column. Each line then goes to the column whose edges contain it.
  const lefts = lines.map((l) => l.left).sort((a, b) => a - b);
  const clusters: { min: number; max: number }[] = [{ min: lefts[0], max: lefts[0] }];
  for (const x of lefts.slice(1)) {
    const last = clusters[clusters.length - 1];
    if (x - last.max > lineH * 1.2) clusters.push({ min: x, max: x });
    else last.max = x;
  }
  const starts = clusters.map((c) => c.min);
  const columnOf = (x: number) => {
    let col = 0;
    for (let i = 0; i < clusters.length; i++) if (x >= clusters[i].min) col = i;
    return col;
  };

  return rows.map((row) => {
    const cells: string[] = new Array(starts.length).fill('');
    for (const line of row.sort((a, b) => a.left - b.left)) {
      const c = columnOf(line.left);
      cells[c] = cells[c] ? `${cells[c]} ${line.text}` : line.text;
    }
    // Drop empty trailing cells.
    while (cells.length > 1 && !cells[cells.length - 1]) cells.pop();
    return cells;
  });
}

/** Recognises the text on a page and returns it as table rows. */
export async function tableFromImage(uri: string): Promise<string[][]> {
  const result = await TextRecognition.recognize(uri, TextRecognitionScript.LATIN);
  const lines: Line[] = [];
  for (const block of result.blocks) {
    for (const line of block.lines) {
      const f = line.frame;
      if (!f || !line.text.trim()) continue;
      lines.push({ text: line.text.trim(), left: f.left, top: f.top, width: f.width, height: f.height });
    }
  }
  return linesToTable(lines);
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

const colName = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** Plain numbers ("1,250.50", "-3", "45%") become real numbers so sums work. */
function cellXml(ref: string, value: string) {
  const plain = value.replace(/,/g, '');
  if (/^-?\d+(\.\d+)?$/.test(plain) && plain.length < 16 && !/^0\d/.test(plain)) {
    return `<c r="${ref}"><v>${plain}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

export function buildXlsx(sheets: { name: string; rows: string[][] }[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const sheetEntries = sheets.map((sheet, i) => {
    const rows = sheet.rows
      .map(
        (row, r) =>
          `<row r="${r + 1}">${row.map((v, c) => (v ? cellXml(`${colName(c)}${r + 1}`, v) : '')).join('')}</row>`,
      )
      .join('');
    const widest = Math.max(1, ...sheet.rows.map((r) => r.length));
    const cols = `<cols><col min="1" max="${widest}" width="22" customWidth="1"/></cols>`;
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData></worksheet>`,
    );
    // Sheet names: max 31 chars, no []:*?/\
    const name = escapeXml(sheet.name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || `Sheet${i + 1}`);
    return { name, id: i + 1 };
  });

  files['[Content_Types].xml'] = strToU8(
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetEntries
      .map(
        (s) =>
          `<Override PartName="/xl/worksheets/sheet${s.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('')}</Types>`,
  );
  files['_rels/.rels'] = strToU8(
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  files['xl/workbook.xml'] = strToU8(
    `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries
      .map((s) => `<sheet name="${s.name}" sheetId="${s.id}" r:id="rId${s.id}"/>`)
      .join('')}</sheets></workbook>`,
  );
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetEntries
      .map(
        (s) =>
          `<Relationship Id="rId${s.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${s.id}.xml"/>`,
      )
      .join('')}</Relationships>`,
  );
  return zipSync(files);
}

/** Recognises tables on each page (one sheet per page) and shares an .xlsx. */
export async function shareAsExcel(pageUris: string[], title: string, onProgress?: (done: number, total: number) => void) {
  const sheets: { name: string; rows: string[][] }[] = [];
  for (let i = 0; i < pageUris.length; i++) {
    sheets.push({ name: `Page ${i + 1}`, rows: await tableFromImage(pageUris[i]) });
    onProgress?.(i + 1, pageUris.length);
  }
  if (sheets.every((s) => s.rows.length === 0)) throw new Error('No text was found on these pages.');
  const name = safeName(title, 'Table');
  await writeAndShare(
    buildXlsx(sheets),
    `${name}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

// ---------------------------------------------------------------------------
// PowerPoint
// ---------------------------------------------------------------------------

const P_NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EMPTY_TREE =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

const solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
const THEME = `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="ScanKaro"><a:themeElements><a:clrScheme name="ScanKaro"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F1F1F"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="EF4444"/></a:accent2><a:accent3><a:srgbClr val="F59E0B"/></a:accent3><a:accent4><a:srgbClr val="10B981"/></a:accent4><a:accent5><a:srgbClr val="8B5CF6"/></a:accent5><a:accent6><a:srgbClr val="EC4899"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="ScanKaro"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="ScanKaro"><a:fillStyleLst>${solid}${solid}${solid}</a:fillStyleLst><a:lnStyleLst><a:ln w="6350">${solid}</a:ln><a:ln w="12700">${solid}</a:ln><a:ln w="19050">${solid}</a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${solid}${solid}${solid}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

const relsXml = (rels: [string, string, string][]) =>
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`)
    .join('')}</Relationships>`;

/** One slide per image, each image fitted and centred. Slide shape follows the first image. */
export function buildPptx(images: { bytes: Uint8Array; width: number; height: number }[]): Uint8Array {
  const cx = 9144000; // 10 in
  const first = images[0];
  const cy = Math.round(Math.min(Math.max((cx * first.height) / first.width, 914400), 51206400 - 1));
  const files: Record<string, Uint8Array> = {};

  images.forEach((img, i) => {
    const n = i + 1;
    const scale = Math.min(cx / img.width, cy / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    files[`ppt/media/image${n}.jpg`] = img.bytes;
    files[`ppt/slides/slide${n}.xml`] = strToU8(
      `${XML}<p:sld ${P_NS}><p:cSld><p:spTree>${EMPTY_TREE}<p:pic><p:nvPicPr><p:cNvPr id="2" name="Page ${n}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${Math.round((cx - w) / 2)}" y="${Math.round((cy - h) / 2)}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    );
    files[`ppt/slides/_rels/slide${n}.xml.rels`] = strToU8(
      relsXml([
        ['rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'],
        ['rId2', `${REL}/image`, `../media/image${n}.jpg`],
      ]),
    );
  });

  files['[Content_Types].xml'] = strToU8(
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${images
      .map(
        (_, i) =>
          `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
      )
      .join('')}</Types>`,
  );
  files['_rels/.rels'] = strToU8(relsXml([['rId1', `${REL}/officeDocument`, 'ppt/presentation.xml']]));
  files['ppt/presentation.xml'] = strToU8(
    `${XML}<p:presentation ${P_NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${images
      .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`)
      .join('')}</p:sldIdLst><p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  );
  files['ppt/_rels/presentation.xml.rels'] = strToU8(
    relsXml([
      ['rId1', `${REL}/slideMaster`, 'slideMasters/slideMaster1.xml'],
      ['rId2', `${REL}/theme`, 'theme/theme1.xml'],
      ...images.map((_, i) => [`rId${i + 3}`, `${REL}/slide`, `slides/slide${i + 1}.xml`] as [string, string, string]),
    ]),
  );
  files['ppt/slideMasters/slideMaster1.xml'] = strToU8(
    `${XML}<p:sldMaster ${P_NS}><p:cSld><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
  );
  files['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = strToU8(
    relsXml([
      ['rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'],
      ['rId2', `${REL}/theme`, '../theme/theme1.xml'],
    ]),
  );
  files['ppt/slideLayouts/slideLayout1.xml'] = strToU8(
    `${XML}<p:sldLayout ${P_NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  );
  files['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = strToU8(
    relsXml([['rId1', `${REL}/slideMaster`, '../slideMasters/slideMaster1.xml']]),
  );
  files['ppt/theme/theme1.xml'] = strToU8(THEME);
  // Images are already compressed JPEGs: store them, compress only the XML.
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, [v, { level: k.endsWith('.jpg') ? 0 : 6 }]] as const),
    ) as Record<string, [Uint8Array, { level: 0 | 6 }]>,
  );
}

/** Shares the pages as a .pptx, one page per slide. */
export async function shareAsPptx(pageUris: string[], title: string) {
  const images = [];
  for (const uri of pageUris) {
    const size = await getImageSizeFromUri(uri);
    images.push({ bytes: await new File(uri).bytes(), width: size.width, height: size.height });
  }
  if (images.length === 0) throw new Error('This document has no pages.');
  const name = safeName(title, 'Slides');
  await writeAndShare(
    buildPptx(images),
    `${name}.pptx`,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );
}
