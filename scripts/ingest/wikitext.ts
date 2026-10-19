/*
 * Minimal MediaWiki wikitext table reader: enough for the list tables on
 * Gundam Wiki and Wikipedia (headers, ||-separated cells, attributes,
 * rowspan, multi-line cells), with each table tagged by its heading path.
 */

export type Link = { target: string; label: string };
export type Cell = { text: string; links: Link[]; raw: string };
export type Table = { headings: string[]; headers: string[]; rows: Cell[][] };

/** Split on `sep` only outside [[...]] and {{...}}. */
export function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depthL = 0;
  let depthT = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === "[[") (depthL++, (cur += two), i++);
    else if (two === "]]") ((depthL = Math.max(0, depthL - 1)), (cur += two), i++);
    else if (two === "{{") (depthT++, (cur += two), i++);
    else if (two === "}}") ((depthT = Math.max(0, depthT - 1)), (cur += two), i++);
    else if (depthL === 0 && depthT === 0 && s.startsWith(sep, i)) {
      out.push(cur);
      cur = "";
      i += sep.length - 1;
    } else cur += s[i];
  }
  out.push(cur);
  return out;
}

/** Removes balanced [[File:...]] / [[Image:...]] including nested links in captions. */
function stripFiles(s: string): string {
  let out = s;
  for (;;) {
    const m = /\[\[(File|Image|ファイル|画像):/i.exec(out);
    if (!m) return out;
    let depth = 0;
    let j = m.index;
    for (; j < out.length - 1; j++) {
      if (out.startsWith("[[", j)) (depth++, j++);
      else if (out.startsWith("]]", j)) {
        depth--;
        j++;
        if (depth === 0) break;
      }
    }
    out = out.slice(0, m.index) + out.slice(j + 1);
  }
}

export function cleanCell(raw: string): Cell {
  let s = raw;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<ref[^>]*\/>/gi, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = stripFiles(s);
  s = s.replace(/\{\{\s*(?:nihongo|lang)\s*\|([^|}]*)[^}]*\}\}/gi, "$1");
  for (let k = 0; k < 3; k++) s = s.replace(/\{\{[^{}]*\}\}/g, "");
  const links: Link[] = [];
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, target: string, label?: string) => {
    const t = target.trim();
    const l = (label ?? t.split("#")[0]).trim();
    links.push({ target: t, label: l });
    return l;
  });
  s = s.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1").replace(/\[https?:\/\/\S+\]/g, "");
  s = s.replace(/'''?/g, "").replace(/<[^>]+>/g, "");
  s = s.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return { text: s, links, raw };
}

/** Strips a leading `attr="..." |` from a cell. */
function dropAttributes(cell: string): { attrs: string; body: string } {
  const parts = splitTop(cell, "|");
  if (parts.length > 1 && /^\s*[a-z-]+\s*=/.test(parts[0]) && !parts[0].includes("[[")) {
    return { attrs: parts[0], body: parts.slice(1).join("|") };
  }
  return { attrs: "", body: cell };
}

export function parseTables(wikitext: string): Table[] {
  const lines = wikitext.split("\n");
  const tables: Table[] = [];
  const headings: string[] = [];
  let t: { headers: string[]; rows: string[][]; rowAttrs: string[][]; headings: string[] } | null = null;
  let depth = 0;

  const flush = () => {
    if (!t) return;
    tables.push(finalize(t));
    t = null;
  };

  for (const lineRaw of lines) {
    const line = lineRaw.trimEnd();
    const h = /^(=+)\s*(.*?)\s*\1\s*$/.exec(line);
    if (h && !t) {
      const level = h[1].length;
      headings.length = Math.max(0, level - 2);
      headings[level - 2] = cleanCell(h[2]).text;
      continue;
    }
    if (line.startsWith("{|")) {
      depth++;
      if (depth === 1) t = { headers: [], rows: [], rowAttrs: [], headings: headings.filter(Boolean) };
      continue;
    }
    if (!t) continue;
    if (line.startsWith("|}")) {
      depth--;
      if (depth === 0) flush();
      continue;
    }
    if (depth > 1) continue; // ignore nested tables
    if (line.startsWith("|-")) {
      t.rows.push([]);
      t.rowAttrs.push([]);
      continue;
    }
    if (line.startsWith("|+")) continue;
    if (line.startsWith("!")) {
      // Some tables separate header cells with "||" instead of "!!".
      for (const c of splitTop(line.slice(1), "!!").flatMap((x) => splitTop(x, "||")))
        t.headers.push(cleanCell(dropAttributes(c).body).text);
      continue;
    }
    if (line.startsWith("|")) {
      if (!t.rows.length) (t.rows.push([]), t.rowAttrs.push([]));
      const row = t.rows[t.rows.length - 1];
      const attrs = t.rowAttrs[t.rowAttrs.length - 1];
      for (const c of splitTop(line.slice(1), "||")) {
        const { attrs: a, body } = dropAttributes(c);
        row.push(body);
        attrs.push(a);
      }
      continue;
    }
    // continuation of the previous cell
    const row = t.rows[t.rows.length - 1];
    if (row?.length) row[row.length - 1] += `\n${line}`;
  }
  return tables;
}

function finalize(t: { headers: string[]; rows: string[][]; rowAttrs: string[][]; headings: string[] }): Table {
  const out: Cell[][] = [];
  const carry: { cell: Cell; left: number }[] = [];
  t.rows.forEach((raw, ri) => {
    if (!raw.length) return;
    const row: Cell[] = [];
    let src = 0;
    for (let col = 0; src < raw.length || carry[col]?.left > 0; col++) {
      if (carry[col]?.left > 0) {
        row.push(carry[col].cell);
        carry[col].left--;
        continue;
      }
      const cell = cleanCell(raw[src]);
      const span = /rowspan\s*=\s*"?(\d+)/i.exec(t.rowAttrs[ri][src] ?? "");
      if (span && Number(span[1]) > 1) carry[col] = { cell, left: Number(span[1]) - 1 };
      row.push(cell);
      src++;
    }
    out.push(row);
  });
  return { headings: t.headings, headers: t.headers, rows: out };
}
