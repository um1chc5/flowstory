#!/usr/bin/env node
/**
 * Build pipeline for flowstory (M0):
 * validate -> layout -> check -> inline into template.html -> candidate -> rename to final.
 *
 * Usage: node scripts/build.mjs <spec.json> [--out <output.html>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSpec } from './validate.mjs';
import { computeLayout } from './layout.mjs';
import { checkLayout } from './lib/geometry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, '..');

function escapeJsonForScript(obj) {
  return JSON.stringify(obj).replace(/<\//g, '<\\/');
}

function resolveOutputPath(specAbsPath, specId, outArg) {
  if (outArg) return path.resolve(outArg);
  const norm = specAbsPath.replace(/\\/g, '/');
  if (norm.includes('/examples/')) {
    return path.join(path.dirname(specAbsPath), `${specId}.html`);
  }
  return path.resolve(process.cwd(), 'flowstory', specId, `${specId}.html`);
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outArg = outIdx !== -1 ? args[outIdx + 1] : null;
  const fileArg = args.find((a, idx) => !a.startsWith('-') && (outIdx === -1 || idx !== outIdx + 1));

  if (!fileArg) {
    console.error('Usage: node scripts/build.mjs <spec.json> [--out <output.html>]');
    process.exit(1);
  }

  const specAbsPath = path.resolve(fileArg);
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specAbsPath, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse spec JSON: ${err.message}`);
    process.exit(1);
  }

  // 1. Validate
  const val = validateSpec(spec);
  if (!val.ok) {
    console.error(`Validation failed with ${val.errors.length} error(s):`);
    for (const e of val.errors) {
      console.error(`  [${e.code}] ${e.path}: ${e.message}${e.fix ? ` (fix: ${e.fix})` : ''}`);
    }
    process.exit(1);
  }

  // 2. Layout
  const layout = computeLayout(spec);
  const scratchDir = path.resolve(process.cwd(), '.flowstory', spec.id);
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.writeFileSync(path.join(scratchDir, 'layout.json'), JSON.stringify(layout, null, 2));

  // 3. Geometry checks
  const check = checkLayout(spec, layout);
  if (!check.ok) {
    console.error(`Geometry check failed with ${check.errors.length} error(s):`);
    for (const e of check.errors) {
      console.error(`  [${e.code}] ${e.message}`);
    }
    process.exit(1);
  }

  // 4. Inline runtime + data into template.html
  const tplPath = path.join(SKILL_ROOT, 'assets', 'template.html');
  const cssPath = path.join(SKILL_ROOT, 'assets', 'runtime', 'flow.css');
  const jsFiles = ['md.js', 'sheet.js', 'core.js'];

  const template = fs.readFileSync(tplPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const js = jsFiles
    .map((f) => fs.readFileSync(path.join(SKILL_ROOT, 'assets', 'runtime', f), 'utf8'))
    .join('\n');

  const html = template
    .replace('/* __FLOWSTORY_CSS__ */', () => css)
    .replace('__FLOWSTORY_SPEC__', () => escapeJsonForScript(spec))
    .replace('__FLOWSTORY_LAYOUT__', () => escapeJsonForScript(layout))
    .replace('/* __FLOWSTORY_JS__ */', () => js);

  // 5. Write candidate, then rename to final
  const candidatePath = path.join(scratchDir, 'candidate.html');
  fs.writeFileSync(candidatePath, html, 'utf8');

  const finalPath = resolveOutputPath(specAbsPath, spec.id, outArg);
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  fs.renameSync(candidatePath, finalPath);

  const bytes = Buffer.byteLength(html, 'utf8');
  console.log(`Built ${finalPath} (${(bytes / 1024).toFixed(1)} KB, ${layout.nodes.length} nodes, ${layout.edges.length} edges)`);
}

main();
