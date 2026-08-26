// Verifies every navigation target a screen asks for is actually registered in a stack it can
// reach. React Navigation answers an unknown route name with a console warning and a no-op, so a
// broken link is INVISIBLE in CI, in typecheck and in the bundle - the button just does nothing.
//
// Written after PlayerStats/TeamDetail had to be registered in three more stacks: the destinations
// existed, but only in ProfileStack and TeamsStack, so any link from a match would have silently
// bounced the user to another tab or done nothing at all.
//
// Reachability rule: a screen can navigate to (a) any route in its OWN stack, (b) any tab name,
// and (c) any route reached explicitly via navigate('Tab', { screen: 'X' }).
const fs = require('fs');
const path = require('path');

const STACK_DIR = 'src/navigation/stacks';
const stackOf = {};      // screen component file -> stack name
const routesInStack = {}; // stack name -> Set(route names)
const tabNames = new Set();

for (const f of fs.readdirSync(STACK_DIR)) {
  if (!f.endsWith('.tsx')) continue;
  const stack = f.replace('.tsx', '');
  const src = fs.readFileSync(path.join(STACK_DIR, f), 'utf8');
  routesInStack[stack] = new Set([...src.matchAll(/name="([^"]+)"\s+component=\{(\w+)\}/g)].map((m) => m[1]));
  for (const m of src.matchAll(/name="([^"]+)"\s+component=\{(\w+)\}/g)) {
    stackOf[m[2]] = stack;
  }
}
const tabSrc = fs.readFileSync('src/navigation/MainTabNavigator.tsx', 'utf8');
for (const m of tabSrc.matchAll(/<Tab\.Screen\s+name="([^"]+)"/g)) tabNames.add(m[1]);

// component name -> screen file
const compFile = {};
for (const dir of ['src/screens', 'src/components']) {
  for (const f of fs.readdirSync(dir)) {
    if (!/\.tsx$/.test(f)) continue;
    compFile[f.replace('.tsx', '')] = path.join(dir, f);
  }
}

const problems = [];
for (const [comp, stack] of Object.entries(stackOf)) {
  const file = compFile[comp];
  if (!file || !fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const reachable = new Set([...routesInStack[stack], ...tabNames]);

  // navigate('Tab', { screen: 'X' }) is explicit cross-tab and always allowed
  const crossTab = new Set([...src.matchAll(/navigate\(\s*['"](\w+)['"]\s*,\s*\{\s*screen:\s*['"](\w+)['"]/g)].map((m) => m[2]));

  for (const m of src.matchAll(/navigation\.(?:navigate|push|replace)\(\s*['"](\w+)['"]/g)) {
    const target = m[1];
    if (reachable.has(target) || crossTab.has(target)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    problems.push({ file, line, comp, stack, target });
  }
}

for (const p of problems) {
  console.log(`  ${p.file}:${p.line}  ${p.comp} (in ${p.stack}) navigates to "${p.target}" - not registered there`);
}
console.log(problems.length === 0
  ? `\nOK - every navigation target is reachable from the stack that asks for it.`
  : `\nFAIL - ${problems.length} unreachable navigation target(s). Each is a silently dead control.`);
process.exit(problems.length === 0 ? 0 : 1);
