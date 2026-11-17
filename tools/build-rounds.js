// 노션에서 옮긴 마크다운(src/_notion/*.md)으로 회차 페이지(src/<id>.html)를 만든다.
// 실행: node tools/build-rounds.js
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "..", "src");
const N = (f) => fs.readFileSync(path.join(SRC, "_notion", f), "utf8");

// 회차 목록. vault = 「논술 기출 창고」에서 찾을 제목, mine = 내 답안 파일, extra = 쌤 자료 탭 위에 붙일 링크
const ROUNDS = [
  { id: "k2018", school: "고려대 편입 사회", year: 2018, vault: "2018 고려대 편입 (사회논술)", mine: "k2018-mine.md" },
  { id: "k2020", school: "고려대 편입 사회", year: 2020, vault: "2020 고려대 편입 (사회논술)", mine: "k2020-mine.md",
    extra: '<p><a href="2020-goryeo-review.html">Claude 첨삭 전문 보기 (점수·문단별 첨삭·수정본) →</a></p>' },
  { id: "y2018", school: "연세대 편입 사회", year: 2018, vault: "2018 연세대 편입 (사회계열)", mine: "y2018-mine.md", skipVaultMine: true },
  { id: "y2024", school: "연세대 편입 사회", year: 2024, vault: "2024 연세대 편입 (사회계열)" },
];

// ---- 노션 마크다운 → HTML ----
const SPAN = { blue: "c-blue", red: "c-red", yellow_bg: "bg-yellow", blue_bg: "bg-blue", gray: "c-gray" };
function inline(s) {
  return s
    .replace(/\\</g, "&lt;")
    .replace(/\\([\[\]~{}*_#|>-])/g, "$1")
    .replace(/<mention[^>]*>(.*?)<\/mention>/g, "$1")
    .replace(/<span color="([a-z_]+)">/g, (_, c) => `<span class="${SPAN[c] || ""}">`)
    .replace(/<span discussion-urls="[^"]*">/g, "<span>");
}
function md(text) {
  const L = text.replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  const flushList = (items) => {
    // items: [indent, ordered, text]
    let html = "", stack = [];
    for (const [ind, ord, t] of items) {
      while (stack.length && stack[stack.length - 1].ind > ind) html += `</li></${stack.pop().tag}>`;
      const top = stack[stack.length - 1];
      if (!top || ind > top.ind) { const tag = ord ? "ol" : "ul"; stack.push({ ind, tag }); html += `<${tag}><li>`; }
      else html += "</li><li>";
      html += inline(t);
    }
    while (stack.length) html += `</li></${stack.pop().tag}>`;
    return html;
  };
  while (i < L.length) {
    let l = L[i];
    const t = l.trim();
    if (!t || t === "<p />" || t === "<table-of-contents />" || t === "<b> </b>") { i++; continue; }
    if (t === "<toggle>") { out.push(`<details><summary>${inline(L[i + 1].trim())}</summary>`); i += 2; continue; }
    if (t === "</toggle>") { out.push("</details>"); i++; continue; }
    if (/^<callout/.test(t)) { out.push('<div class="callout">'); i++; continue; }
    if (t === "</callout>") { out.push("</div>"); i++; continue; }
    if (/^<quote/.test(t)) { out.push("<blockquote>"); i++; continue; }
    if (t === "</quote>") { out.push("</blockquote>"); i++; continue; }
    if (/^<p color="gray">/.test(t)) {
      const buf = []; i++;
      while (i < L.length && L[i].trim() !== "</p>") { if (L[i].trim()) buf.push(inline(L[i].trim())); i++; }
      out.push(`<p class="gray">${buf.join("<br>")}</p>`); i++; continue;
    }
    if (/^<table/.test(t)) { // 노션 HTML 표는 그대로
      let buf = ["<div class=tbl><table>"]; i++;
      while (i < L.length && L[i].trim() !== "</table>") { buf.push(inline(L[i].trim())); i++; }
      out.push(buf.join("") + "</table></div>"); i++; continue;
    }
    if (/^<\/?(ul|ol|li|h2)>$/.test(t)) { out.push(t); i++; continue; }
    if (t === "---") { out.push("<hr>"); i++; continue; }
    let m;
    if ((m = t.match(/^(#{1,4}) (.*)$/))) { const lv = { 1: 2, 2: 3, 3: 3, 4: 4 }[m[1].length]; out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); i++; continue; }
    if (t.startsWith("> ")) { out.push(`<blockquote><p>${inline(t.slice(2))}</p></blockquote>`); i++; continue; }
    if (t.startsWith("|")) {
      const rows = [];
      while (i < L.length && L[i].trim().startsWith("|")) { rows.push(L[i].trim()); i++; }
      const cells = (r) => r.slice(1, -1).split(/(?<!\\)\|/).map((c) => inline(c.trim()));
      const body = rows.filter((r) => !/^\|[\s|:-]+\|$/.test(r));
      const [head, ...rest] = body;
      out.push("<div class=tbl><table><thead><tr>" + cells(head).map((c) => `<th>${c}</th>`).join("") + "</tr></thead><tbody>" +
        rest.map((r) => "<tr>" + cells(r).map((c) => `<td>${c}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>");
      continue;
    }
    if (/^\s*(- |\d+\. )/.test(l)) {
      const items = [];
      while (i < L.length && /^\s*(- |\d+\. )/.test(L[i])) {
        const mm = L[i].match(/^(\s*)(- |\d+\. )(.*)$/);
        items.push([mm[1].length, mm[2] !== "- ", mm[3]]); i++;
      }
      out.push(flushList(items)); continue;
    }
    let gray = false;
    if (/\\\{color="gray"\\\}\s*$/.test(t)) { gray = true; l = t.replace(/\s*\\\{color="gray"\\\}\s*$/, ""); }
    out.push(`<p${gray ? ' class="gray"' : ""}>${inline(l.trim())}</p>`); i++;
  }
  return out.join("\n");
}

// 「기출 창고」에서 회차 토글 하나를 꺼내 ### 단위로 나눈다
function vaultBlock(title) {
  const L = N("vault.md").replace(/\r/g, "").split("\n");
  const s = L.findIndex((l) => l.trim().startsWith(title));
  if (s < 0) throw new Error("기출 창고에서 못 찾음: " + title);
  let depth = 1, e = s + 1;
  for (; e < L.length; e++) {
    const t = L[e].trim();
    if (/^<toggle/.test(t)) depth++;
    if (t === "</toggle>" && --depth === 0) break;
  }
  const body = L.slice(s + 1, e);
  const fullTitle = L[s].trim();
  const parts = { meta: [], sections: [] };
  let cur = null;
  for (const l of body) {
    const m = l.match(/^### (.*)$/);
    if (m) { cur = { name: m[1].trim(), lines: [] }; parts.sections.push(cur); continue; }
    (cur ? cur.lines : parts.meta).push(l);
  }
  return { fullTitle, ...parts };
}

const PAGE = fs.readFileSync(path.join(__dirname, "round-template.html"), "utf8");
for (const r of ROUNDS) {
  const v = vaultBlock(r.vault);
  const text = { q: [], mine: [], ref: [] };
  for (const s of v.sections) {
    const body = s.lines.join("\n");
    if (s.name === "문제") text.q.push(md(body));
    else if (s.name === "내 답안") { if (!r.skipVaultMine && !/\(아직 없음\)/.test(body)) text.mine.push(md(body)); }
    else text.ref.push(`<h3>${inline(s.name)}</h3>\n` + md(body));
  }
  if (r.mine) text.mine.push(md(N(r.mine)));
  const topic = v.fullTitle.split("–")[1]?.trim() || "";
  const fill = {
    TITLE: `${r.year} ${r.school.replace(" 사회", "")}`,
    SCHOOL: r.school,
    YEAR: String(r.year),
    TOPIC: inline(topic),
    META: md(v.meta.join("\n")),
    Q: text.q.join("\n") || "<p class=gray>원문이 아직 없어요.</p>",
    MINE: text.mine.join("\n") || "<p class=gray>아직 쓴 답안이 없어요.</p>",
    REF: (r.extra || "") + (text.ref.join("\n") || "<p class=gray>쌤 자료가 아직 없어요.</p>"),
  };
  const html = PAGE.replace(/\{\{(\w+)\}\}/g, (_, k) => fill[k]);
  fs.writeFileSync(path.join(SRC, r.id + ".html"), html);
  console.log("✓", r.id + ".html", `(원문 ${text.q.length ? "있음" : "없음"}, 내 답안 ${text.mine.length ? "있음" : "없음"}, 쌤 자료 ${text.ref.length} 묶음)`);
}
