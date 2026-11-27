/**
 * Reading order for OCR blocks on multi-column pages (newspapers, forms, two-column
 * articles). Full-width blocks split the page into sections; within a section,
 * side-by-side blocks form columns, read left column first, each top to bottom.
 */

export type Box = { left: number; top: number; width: number; height: number };
export type Block = { text: string; frame?: Box };

/** A block wider than this share of the text area spans the page (heading, wide paragraph). */
const WIDE = 0.6;

const overlapX = (a: Box, b: { left: number; right: number }) =>
  Math.max(0, Math.min(a.left + a.width, b.right) - Math.max(a.left, b.left));

export function orderBlocks<T extends Block>(blocks: T[]): T[] {
  const framed = blocks.filter((b) => b.frame);
  if (framed.length < 2) return blocks;
  const minX = Math.min(...framed.map((b) => b.frame!.left));
  const maxX = Math.max(...framed.map((b) => b.frame!.left + b.frame!.width));
  const areaWidth = Math.max(1, maxX - minX);

  const byTop = [...framed].sort((a, b) => a.frame!.top - b.frame!.top);
  const out: T[] = [];
  let section: T[] = [];

  const flush = () => {
    if (section.length === 0) return;
    // Group into columns by horizontal overlap.
    const columns: { left: number; right: number; items: T[] }[] = [];
    for (const block of [...section].sort((a, b) => a.frame!.left - b.frame!.left)) {
      const f = block.frame!;
      const col = columns.find((c) => overlapX(f, c) > 0.5 * Math.min(f.width, c.right - c.left));
      if (col) {
        col.items.push(block);
        col.left = Math.min(col.left, f.left);
        col.right = Math.max(col.right, f.left + f.width);
      } else {
        columns.push({ left: f.left, right: f.left + f.width, items: [block] });
      }
    }
    columns
      .sort((a, b) => a.left - b.left)
      .forEach((c) => out.push(...c.items.sort((a, b) => a.frame!.top - b.frame!.top)));
    section = [];
  };

  for (const block of byTop) {
    if (block.frame!.width > WIDE * areaWidth) {
      flush();
      out.push(block);
    } else {
      section.push(block);
    }
  }
  flush();
  // Blocks without a position keep ML Kit's order, at the end.
  return [...out, ...blocks.filter((b) => !b.frame)];
}
