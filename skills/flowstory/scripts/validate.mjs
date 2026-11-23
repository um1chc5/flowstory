#!/usr/bin/env node
/**
 * Validate a flowstory spec.json against the core schema and reference rules.
 * Usage: node scripts/validate.mjs <spec.json> [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSchema } from './lib/schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILTIN_KINDS = new Set([
  'client', 'service', 'external', 'queue', 'worker', 'store', 'cache', 'function', 'user'
]);

const DEEP_NODE_SECTIONS = new Set(['title', 'kicker', 'role', 'how', 'code', 'weak', 'read']);
const DEEP_PROBLEM_SECTIONS = new Set(['problem', 'happens', 'cause', 'impact']);
const DEEP_FIX_SECTIONS = new Set(['fix', 'changes', 'why', 'cost']);

const HTML_TAG_RE = /<[a-zA-Z!/][^>]*>/;
const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

function escapePointer(seg) {
  return String(seg).replace(/~/g, '~0').replace(/\//g, '~1');
}

function checkUnsafeMarkup(text, jsonPath, warnings) {
  if (typeof text !== 'string') return;
  if (HTML_TAG_RE.test(text)) {
    warnings.push({
      code: 'markup-unsafe',
      path: jsonPath,
      message: 'Inline text contains HTML tags, which will be rendered as literal text.',
      fix: 'Remove HTML tags and use the supported markdown subset (`code`, **bold**, *italic*, [label](https://...)).'
    });
  }
  MD_LINK_RE.lastIndex = 0;
  let m;
  while ((m = MD_LINK_RE.exec(text)) !== null) {
    const url = m[2].trim();
    if (!/^https?:\/\//i.test(url)) {
      warnings.push({
        code: 'markup-unsafe',
        path: jsonPath,
        message: `Unsafe or non-http(s) link '${url}' in inline text.`,
        fix: 'Use an http:// or https:// URL.'
      });
    }
  }
}

const SUPPORTED_TYPES = new Set(['flow']);

export function validateSpec(spec) {
  const schemaPath = path.join(__dirname, 'spec.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  const errors = validateSchema(spec, schema);
  const warnings = [];

  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return { ok: false, errors, warnings };
  }

  // Collect declared IDs
  const laneIds = new Set();
  if (Array.isArray(spec.lanes)) {
    spec.lanes.forEach((lane, i) => {
      if (lane && typeof lane.id === 'string') {
        if (laneIds.has(lane.id)) {
          errors.push({
            code: 'ref-unknown',
            path: `/lanes/${i}/id`,
            message: `Duplicate lane id '${lane.id}'.`,
            fix: `Use a unique id for lane at index ${i}.`
          });
        }
        laneIds.add(lane.id);
      }
      if (lane && lane.label) checkUnsafeMarkup(lane.label, `/lanes/${i}/label`, warnings);
    });
  }

  const customKinds = spec.kinds && typeof spec.kinds === 'object' ? spec.kinds : {};
  const validKinds = new Set([...BUILTIN_KINDS, ...Object.keys(customKinds)]);
  for (const [kId, kDef] of Object.entries(customKinds)) {
    if (kDef && kDef.like && !validKinds.has(kDef.like)) {
      errors.push({
        code: 'ref-unknown',
        path: `/kinds/${escapePointer(kId)}/like`,
        message: `Custom kind '${kId}' references unknown kind '${kDef.like}' in 'like'.`,
        fix: `Use one of: ${[...BUILTIN_KINDS].join(', ')}.`
      });
    }
  }

  const deepKeys = new Set(
    spec.deep && typeof spec.deep === 'object' ? Object.keys(spec.deep) : []
  );

  // Validate nodes
  const nodeIds = new Set();
  if (Array.isArray(spec.nodes)) {
    spec.nodes.forEach((node, i) => {
      if (!node || typeof node !== 'object') return;
      if (typeof node.id === 'string') {
        if (nodeIds.has(node.id)) {
          errors.push({
            code: 'ref-unknown',
            path: `/nodes/${i}/id`,
            message: `Duplicate node id '${node.id}'.`,
            fix: `Give node at index ${i} a unique id.`
          });
        }
        nodeIds.add(node.id);
      }
      if (typeof node.lane === 'string' && !laneIds.has(node.lane)) {
        errors.push({
          code: 'ref-unknown',
          path: `/nodes/${i}/lane`,
          message: `Node '${node.id || i}' references unknown lane '${node.lane}'.`,
          fix: `Use one of the declared lanes: ${[...laneIds].join(', ')}.`
        });
      }
      if (typeof node.kind === 'string' && !validKinds.has(node.kind)) {
        errors.push({
          code: 'ref-unknown',
          path: `/nodes/${i}/kind`,
          message: `Node '${node.id || i}' uses unknown kind '${node.kind}'.`,
          fix: `Use a built-in kind (${[...BUILTIN_KINDS].join(', ')}) or define '${node.kind}' in 'kinds'.`
        });
      }
      if (typeof node.deep === 'string' && !deepKeys.has(node.deep)) {
        errors.push({
          code: 'ref-unknown',
          path: `/nodes/${i}/deep`,
          message: `Node '${node.id || i}' references unknown deep entry '${node.deep}'.`,
          fix: `Add '${node.deep}' to 'deep' or remove the 'deep' property.`
        });
      }
      if (node.label) checkUnsafeMarkup(node.label, `/nodes/${i}/label`, warnings);
      if (node.sub) checkUnsafeMarkup(node.sub, `/nodes/${i}/sub`, warnings);
    });
  }

  // Validate edges
  const edgeIds = new Set();
  if (Array.isArray(spec.edges)) {
    spec.edges.forEach((edge, i) => {
      if (!edge || typeof edge !== 'object') return;
      if (typeof edge.from === 'string' && !nodeIds.has(edge.from)) {
        errors.push({
          code: 'ref-unknown',
          path: `/edges/${i}/from`,
          message: `Edge '${edge.id || i}' references unknown source node '${edge.from}'.`,
          fix: `Set 'from' to an existing node id.`
        });
      }
      if (typeof edge.to === 'string' && !nodeIds.has(edge.to)) {
        errors.push({
          code: 'ref-unknown',
          path: `/edges/${i}/to`,
          message: `Edge '${edge.id || i}' references unknown target node '${edge.to}'.`,
          fix: `Set 'to' to an existing node id.`
        });
      }
      if (typeof edge.id === 'string') {
        if (edgeIds.has(edge.id)) {
          errors.push({
            code: 'edge-id',
            path: `/edges/${i}/id`,
            message: `Duplicate edge id '${edge.id}'.`,
            fix: `Append a suffix like '${edge.from}>${edge.to}#2'.`
          });
        }
        edgeIds.add(edge.id);
        if (typeof edge.from === 'string' && typeof edge.to === 'string') {
          const base = `${edge.from}>${edge.to}`;
          const valid = edge.id === base || edge.id.startsWith(`${base}#`);
          if (!valid) {
            errors.push({
              code: 'edge-id',
              path: `/edges/${i}/id`,
              message: `Edge id '${edge.id}' must match '${base}' or '${base}#<n>'.`,
              fix: `Rename edge id to '${base}'.`
            });
          }
        }
      }
      if (edge.label) checkUnsafeMarkup(edge.label, `/edges/${i}/label`, warnings);
    });
  }

  // Validate groups
  const groupIds = new Set();
  if (Array.isArray(spec.groups)) {
    spec.groups.forEach((grp, i) => {
      if (grp && typeof grp.id === 'string') {
        if (groupIds.has(grp.id)) {
          errors.push({
            code: 'ref-unknown',
            path: `/groups/${i}/id`,
            message: `Duplicate group id '${grp.id}'.`
          });
        }
        groupIds.add(grp.id);
      }
    });
    spec.groups.forEach((grp, i) => {
      if (!grp || typeof grp !== 'object') return;
      if (Array.isArray(grp.nodes)) {
        grp.nodes.forEach((nid, j) => {
          if (!nodeIds.has(nid)) {
            errors.push({
              code: 'ref-unknown',
              path: `/groups/${i}/nodes/${j}`,
              message: `Group '${grp.id || i}' references unknown node '${nid}'.`,
              fix: `Use an existing node id in 'groups[${i}].nodes'.`
            });
          }
        });
      }
      if (Array.isArray(grp.groups)) {
        grp.groups.forEach((gid, j) => {
          if (!groupIds.has(gid) || gid === grp.id) {
            errors.push({
              code: 'ref-unknown',
              path: `/groups/${i}/groups/${j}`,
              message: `Group '${grp.id || i}' references invalid or unknown child group '${gid}'.`
            });
          }
        });
      }
      if (grp.label) checkUnsafeMarkup(grp.label, `/groups/${i}/label`, warnings);
    });
  }

  // Validate deep-dive entries
  if (spec.deep && typeof spec.deep === 'object') {
    for (const [key, entry] of Object.entries(spec.deep)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const basePath = `/deep/${escapePointer(key)}`;
      const allowed = 'problem' in entry
        ? DEEP_PROBLEM_SECTIONS
        : 'fix' in entry
          ? DEEP_FIX_SECTIONS
          : DEEP_NODE_SECTIONS;

      for (const [sec, val] of Object.entries(entry)) {
        const secPath = `${basePath}/${escapePointer(sec)}`;
        if (!allowed.has(sec)) {
          errors.push({
            code: 'deep-section',
            path: secPath,
            message: `Unknown deep-dive section '${sec}' in '${key}'.`,
            fix: `Allowed sections here are: ${[...allowed].join(', ')}.`
          });
          continue;
        }
        if (typeof val === 'string') {
          checkUnsafeMarkup(val, secPath, warnings);
        } else if (Array.isArray(val)) {
          val.forEach((item, idx) => {
            if (typeof item === 'string') {
              checkUnsafeMarkup(item, `${secPath}/${idx}`, warnings);
            } else if (item && typeof item === 'object') {
              if (item.title) checkUnsafeMarkup(item.title, `${secPath}/${idx}/title`, warnings);
              if (item.note) checkUnsafeMarkup(item.note, `${secPath}/${idx}/note`, warnings);
              if (sec === 'read' && item.url && !/^https?:\/\//i.test(String(item.url).trim())) {
                warnings.push({
                  code: 'markup-unsafe',
                  path: `${secPath}/${idx}/url`,
                  message: `Unsafe or non-http(s) URL '${item.url}' in 'read'.`,
                  fix: 'Use an http:// or https:// URL.'
                });
              }
            }
          });
        }
      }
    }
  }

  if (typeof spec.title === 'string') {
    checkUnsafeMarkup(spec.title, '/title', warnings);
  }

  // Diagram types the layout can draw today. The schema lists the planned ones.
  if (typeof spec.type === 'string' && !SUPPORTED_TYPES.has(spec.type)) {
    errors.push({
      code: 'type-unsupported',
      path: '/type',
      message: `Diagram type '${spec.type}' is planned but not supported yet.`,
      fix: `Use one of: ${[...SUPPORTED_TYPES].join(', ')}. Draw other system diagrams as 'flow' for now.`
    });
  }

  // Two nodes in the same lane and row (without manual x/y) would overlap.
  if (Array.isArray(spec.nodes)) {
    const cells = new Map();
    spec.nodes.forEach((node, i) => {
      if (!node || typeof node.lane !== 'string' || typeof node.row !== 'number') return;
      if (typeof node.x === 'number' || typeof node.y === 'number') return;
      const key = `${node.lane}|${node.row}`;
      if (cells.has(key)) {
        const other = cells.get(key);
        const usedRows = spec.nodes.filter((n) => n && n.lane === node.lane && typeof n.row === 'number').map((n) => n.row);
        const freeRow = Math.max(...usedRows) + 1;
        errors.push({
          code: 'cell-conflict',
          path: `/nodes/${i}/row`,
          message: `Node '${node.id}' is in the same lane and row as '${other}' (lane '${node.lane}', row ${node.row}).`,
          fix: `Move '${node.id}' to a free row (e.g. row ${freeRow}) or to another lane.`
        });
      } else {
        cells.set(key, node.id);
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const fileArg = args.find((a) => !a.startsWith('-'));

  if (!fileArg) {
    const out = {
      ok: false,
      errors: [{ code: 'cli', path: '/', message: 'Missing spec.json path argument.' }],
      warnings: []
    };
    console.error(jsonFlag ? JSON.stringify(out, null, 2) : out.errors[0].message);
    process.exit(1);
  }

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(path.resolve(fileArg), 'utf8'));
  } catch (err) {
    const out = {
      ok: false,
      errors: [{ code: 'parse', path: '/', message: `Failed to read/parse JSON: ${err.message}` }],
      warnings: []
    };
    console.log(jsonFlag ? JSON.stringify(out, null, 2) : out.errors[0].message);
    process.exit(1);
  }

  const result = validateSpec(spec);
  if (jsonFlag) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.ok) {
      console.log(`OK (${result.warnings.length} warning(s))`);
    } else {
      console.error(`INVALID: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
      for (const e of result.errors) {
        console.error(`  [${e.code}] ${e.path}: ${e.message}${e.fix ? ` (fix: ${e.fix})` : ''}`);
      }
    }
    for (const w of result.warnings) {
      console.warn(`  [warn:${w.code}] ${w.path}: ${w.message}`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}
