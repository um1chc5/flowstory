#!/usr/bin/env node
/**
 * Layout dispatcher for flowstory specs.
 * Usage: node scripts/layout.mjs <spec.json> [--out <layout.json>] [--check] [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutFlow } from './lib/types/flow.mjs';
import { checkLayout } from './lib/geometry.mjs';

export function computeLayout(spec) {
  if (spec.type === 'flow') {
    return layoutFlow(spec);
  }
  throw new Error(`Diagram type '${spec.type}' is not supported in M0 (only 'flow' is supported).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const checkFlag = args.includes('--check');
  const jsonFlag = args.includes('--json');
  const outIdx = args.indexOf('--out');
  const outArg = outIdx !== -1 ? args[outIdx + 1] : null;
  const fileArg = args.find((a, idx) => !a.startsWith('-') && (outIdx === -1 || idx !== outIdx + 1));

  if (!fileArg) {
    console.error('Usage: node scripts/layout.mjs <spec.json> [--out <layout.json>] [--check] [--json]');
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(path.resolve(fileArg), 'utf8'));
  const layout = computeLayout(spec);
  const check = checkFlag ? checkLayout(spec, layout) : null;

  if (outArg) {
    const outPath = path.resolve(outArg);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(layout, null, 2));
  }

  if (jsonFlag) {
    console.log(JSON.stringify(checkFlag ? { layout, check } : layout, null, 2));
  } else if (checkFlag) {
    if (check.ok) {
      console.log(`Layout OK (${layout.nodes.length} nodes, ${layout.edges.length} edges, ${layout.canvas.width}x${layout.canvas.height})`);
    } else {
      console.error(`Layout check failed with ${check.errors.length} error(s):`);
      for (const e of check.errors) {
        console.error(`  [${e.code}] ${e.message}`);
      }
    }
  } else if (!outArg) {
    console.log(JSON.stringify(layout, null, 2));
  }

  if (check && !check.ok) {
    process.exit(1);
  }
}
