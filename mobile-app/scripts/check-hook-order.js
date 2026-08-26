// Detects the Rules-of-Hooks violation that crashes a screen at runtime:
//
//   "Rendered more hooks than during the previous render."
//
// A hook called AFTER a component's early return runs on some renders and not others, so React's
// hook count changes between renders and the screen unmounts into an error boundary. TypeScript
// cannot see it: the app compiles, bundles, and then dies on the device. This shipped once in
// MatchDetailScreen (a useState added below `if (loading) return ...`), so it is a detector for a
// defect that actually happened.
//
// METHOD - indentation, not brace depth.
//
// The first version of this script counted braces and MISSED the very bug it was written for,
// twice over: brace depth drifts across 2,000 lines of JSX, and the early return sits at depth 2
// inside `if (loading) {` rather than at the top level. Indentation is the reliable signal in a
// consistently-formatted codebase - a component's own statements sit at exactly two spaces, and an
// early return sits at two (bare) or four (inside a top-level `if`).
//
// Verified against a deliberately reintroduced violation before being trusted.
const fs = require('fs');
const path = require('path');

const COMPONENT = /^(?:export\s+default\s+)?(?:export\s+)?function\s+([A-Z]\w*)\s*\(/;

// A hook CALL at the component's own statement level (exactly two spaces).
// The (?<![\w$]) lookbehind is load-bearing: without it `setHouseRulesText(...)` matches, because
// it contains the substring "useRulesText". That produced two false positives on the first run.
const HOOK_CALL = /^\s{2}(?:(?:const|let|var)\s[^=]*=\s*)?(?<![\w$])(use[A-Z]\w*)\s*\(/;

// An EARLY RETURN, distinguished from a return inside a callback.
//
// `return map;` at four spaces inside `useMemo(() => { ... })` looks identical to `return (`
// inside `if (loading) {`. Treating both as early returns produced 22 more false positives. So a
// four-space return only counts when the nearest preceding two-space line opens a conditional.
const RETURN_2 = /^\s{2}return\b/;
const RETURN_4 = /^\s{4}return\b/;
const OPENS_CONDITIONAL = /^\s{2}(?:if\s*\(|\}\s*else)/;

function scanFile(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const starts = [];
  lines.forEach((l, i) => { const m = l.match(COMPONENT); if (m) starts.push({ name: m[1], line: i }); });

  const problems = [];
  for (let c = 0; c < starts.length; c++) {
    const from = starts[c].line;
    const to = c + 1 < starts.length ? starts[c + 1].line : lines.length;
    let firstReturn = null;
    let lastTwoSpaceLine = '';

    for (let i = from + 1; i < to; i++) {
      const code = lines[i].replace(/\/\/.*$/, '');
      if (!code.trim()) continue;

      if (/^\s{2}\S/.test(code)) lastTwoSpaceLine = code;

      if (firstReturn === null) {
        const isEarly = RETURN_2.test(code) || (RETURN_4.test(code) && OPENS_CONDITIONAL.test(lastTwoSpaceLine));
        if (isEarly) { firstReturn = i + 1; }
        continue;
      }

      const m = code.match(HOOK_CALL);
      if (m) {
        problems.push({ component: starts[c].name, hook: m[1], hookLine: i + 1, afterReturnLine: firstReturn, text: code.trim().slice(0, 76) });
      }
    }
  }
  return problems;
}

const roots = ['src/screens', 'src/components', 'src/hooks'];
const files = roots.flatMap((r) =>
  fs.existsSync(r) ? fs.readdirSync(r).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(r, f)) : []
);

let total = 0;
for (const f of files) {
  for (const p of scanFile(f)) {
    total++;
    console.log(`  ${f}:${p.hookLine}  ${p.component}() calls ${p.hook}() after a return at line ${p.afterReturnLine}`);
    console.log(`      ${p.text}`);
  }
}
console.log(total === 0
  ? `\nOK - scanned ${files.length} files, no hook called after an early return.`
  : `\nFAIL - ${total} hook-order violation(s). Each crashes its screen at runtime.`);
process.exit(total === 0 ? 0 : 1);
