#!/usr/bin/env node
/**
 * Adversarial fixture & validation test runner for flowstory M0.
 * Usage: node scripts/test/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSpec } from '../validate.mjs';
import { computeLayout } from '../layout.mjs';
import { checkLayout } from '../lib/geometry.mjs';
import { escapeJsonForScript } from '../build.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

let failed = 0;
let passed = 0;

function pass(name) {
  passed++;
  console.log(`PASS  ${name}`);
}

function fail(name, reason) {
  failed++;
  console.error(`FAIL  ${name}: ${reason}`);
}

// 1. Run layout + geometry fixtures
const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json')).sort();
for (const file of files) {
  const fullPath = path.join(fixturesDir, file);
  const { expect: expected, spec } = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  const val = validateSpec(spec);
  if (!val.ok) {
    fail(file, `Spec validation failed unexpectedly: ${JSON.stringify(val.errors)}`);
    continue;
  }

  const layout = computeLayout(spec);
  const check = checkLayout(spec, layout);

  if (expected === 'clean') {
    if (check.ok) {
      pass(`${file} (expected clean)`);
    } else {
      fail(file, `Expected clean, got errors: ${check.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`);
    }
  } else {
    const hasCode = check.errors.some((e) => e.code === expected);
    if (!check.ok && hasCode) {
      pass(`${file} (expected ${expected})`);
    } else {
      fail(file, `Expected check code '${expected}', got ok=${check.ok} errors=${JSON.stringify(check.errors)}`);
    }
  }
}

// 2. Run core validation rule unit checks
const baseSpec = {
  flowstory: 1,
  id: 'val-test',
  title: 'Validation Test',
  type: 'flow',
  source: 'design',
  lanes: [{ id: 'a' }],
  nodes: [{ id: 'n1', kind: 'service', lane: 'a', row: 0, label: 'N1', deep: 'n1' }],
  edges: [{ id: 'n1>n1', from: 'n1', to: 'n1' }],
  deep: { n1: { role: 'Test role' } }
};

const valTests = [
  {
    name: 'validate: ref-unknown (lane)',
    spec: { ...baseSpec, nodes: [{ id: 'n1', kind: 'service', lane: 'missing', row: 0 }] },
    expectError: 'ref-unknown'
  },
  {
    name: 'validate: edge-id mismatch',
    spec: { ...baseSpec, edges: [{ id: 'bad-id', from: 'n1', to: 'n1' }] },
    expectError: 'edge-id'
  },
  {
    name: 'validate: deep-section unknown',
    spec: { ...baseSpec, deep: { n1: { bogus: 'nope' } } },
    expectError: 'deep-section'
  },
  {
    name: 'validate: cell-conflict',
    spec: { ...baseSpec, nodes: [...baseSpec.nodes, { id: 'n2', kind: 'service', lane: 'a', row: 0, label: 'N2' }] },
    expectError: 'cell-conflict'
  },
  {
    name: 'validate: type-unsupported',
    spec: { ...baseSpec, type: 'sequence' },
    expectError: 'type-unsupported'
  },
  {
    name: 'validate: markup-unsafe warning',
    spec: { ...baseSpec, nodes: [{ id: 'n1', kind: 'service', lane: 'a', row: 0, label: '<script>alert(1)</script>', deep: 'n1' }] },
    expectWarning: 'markup-unsafe'
  }
];

for (const vt of valTests) {
  const res = validateSpec(vt.spec);
  if (vt.expectError) {
    if (!res.ok && res.errors.some((e) => e.code === vt.expectError)) {
      pass(vt.name);
    } else {
      fail(vt.name, `Expected error '${vt.expectError}', got ${JSON.stringify(res)}`);
    }
  } else if (vt.expectWarning) {
    if (res.ok && res.warnings.some((w) => w.code === vt.expectWarning)) {
      pass(vt.name);
    } else {
      fail(vt.name, `Expected warning '${vt.expectWarning}', got ${JSON.stringify(res)}`);
    }
  }
}

// 3. Build: data embedded in <script type="application/json"> must not be able
// to change how the HTML parser reads the page.
{
  const nasty = { t: '</script><!--<script>a & b\u2028', n: 1 };
  const out = escapeJsonForScript(nasty);
  if (/[<>&\u2028\u2029]/.test(out)) {
    fail('build: JSON escaping', `Unescaped character in ${out}`);
  } else if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(nasty)) {
    fail('build: JSON escaping', 'Escaped JSON does not round-trip');
  } else {
    pass('build: JSON escaping');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
