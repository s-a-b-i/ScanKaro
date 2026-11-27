/**
 * Minimal Word (.docx) writer for recognised text: one paragraph per line, a page break
 * between scanned pages, right-to-left paragraphs for Urdu/Arabic. Opens in Word,
 * Google Docs and WPS.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strToU8, zipSync } from 'fflate';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

/** Marks "— Page 2 —" lines written by recognizePages. */
const PAGE_MARK = /^— Page (\d+) —$/;
const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

const escapeXml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Control characters are not allowed in XML.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function paragraph(line: string, options: { bold?: boolean; pageBreakBefore?: boolean } = {}) {
  const rtl = RTL.test(line);
  const pPr = [
    options.pageBreakBefore ? '<w:pageBreakBefore/>' : '',
    rtl ? '<w:bidi/><w:jc w:val="right"/>' : '',
    '<w:spacing w:after="80"/>',
  ].join('');
  const rPr = [options.bold ? '<w:b/><w:sz w:val="28"/>' : '', rtl ? '<w:rtl/>' : ''].join('');
  const run = line ? `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>` : '';
  return `<w:p><w:pPr>${pPr}</w:pPr>${run}</w:p>`;
}

export function buildDocx(text: string, title: string): Uint8Array {
  const body: string[] = [paragraph(title, { bold: true })];
  let firstPage = true;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const mark = line.trim().match(PAGE_MARK);
    if (mark) {
      // Page 1 follows the title directly; later pages start on a new Word page.
      body.push(paragraph(`Page ${mark[1]}`, { bold: true, pageBreakBefore: !firstPage }));
      firstPage = false;
    } else {
      body.push(paragraph(line));
    }
  }

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>ScanKaro</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`;

  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELS),
    'docProps/core.xml': strToU8(core),
    'word/document.xml': strToU8(document),
  });
}

/** Writes the text as a .docx and opens the share sheet. */
export async function shareDocx(text: string, title: string) {
  const safe = title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Text';
  const file = new File(Paths.cache, `${safe}.docx`);
  if (file.exists) file.delete();
  file.create();
  file.write(buildDocx(text, safe));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    dialogTitle: `${safe}.docx`,
  });
}
