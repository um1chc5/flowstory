/**
 * Lightweight, zero-dependency JSON Schema validator for flowstory.
 * Produces errors with { code: 'schema', path: JSONPointer, message, fix? }.
 */

function escapePointer(segment) {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

function getType(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

function matchesType(val, expected) {
  const actual = getType(val);
  if (expected === 'integer') {
    return typeof val === 'number' && Number.isInteger(val);
  }
  return actual === expected;
}

export function validateSchema(data, schema, path = '') {
  const errors = [];

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(data, t))) {
      errors.push({
        code: 'schema',
        path: path || '/',
        message: `Expected ${types.join(' or ')}, got ${getType(data)}.`,
        fix: `Change value at ${path || '/'} to type ${types.join(' or ')}.`
      });
      return errors;
    }
  }

  if (schema.const !== undefined && data !== schema.const) {
    errors.push({
      code: 'schema',
      path: path || '/',
      message: `Expected constant value ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}.`,
      fix: `Set ${path || '/'} to ${JSON.stringify(schema.const)}.`
    });
  }

  if (schema.enum !== undefined && !schema.enum.includes(data)) {
    errors.push({
      code: 'schema',
      path: path || '/',
      message: `Value ${JSON.stringify(data)} is not one of: ${schema.enum.join(', ')}.`,
      fix: `Use one of: ${schema.enum.join(', ')}.`
    });
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({
        code: 'schema',
        path: path || '/',
        message: `String must be at least ${schema.minLength} character(s).`
      });
    }
    if (schema.pattern !== undefined) {
      const re = new RegExp(schema.pattern);
      if (!re.test(data)) {
        errors.push({
          code: 'schema',
          path: path || '/',
          message: `String '${data}' does not match pattern ${schema.pattern}.`
        });
      }
    }
  }

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({
        code: 'schema',
        path: path || '/',
        message: `Number ${data} must be >= ${schema.minimum}.`
      });
    }
    if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) {
      errors.push({
        code: 'schema',
        path: path || '/',
        message: `Number ${data} must be > ${schema.exclusiveMinimum}.`
      });
    }
  }

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({
        code: 'schema',
        path: path || '/',
        message: `Array must have at least ${schema.minItems} item(s).`
      });
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({
        code: 'schema',
        path: path || '/',
        message: `Array must have at most ${schema.maxItems} item(s).`
      });
    }
    if (schema.items) {
      for (let i = 0; i < data.length; i++) {
        errors.push(...validateSchema(data[i], schema.items, `${path}/${i}`));
      }
    }
  }

  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray(schema.required)) {
      for (const req of schema.required) {
        if (!(req in data)) {
          errors.push({
            code: 'schema',
            path: path || '/',
            message: `Missing required property '${req}'.`,
            fix: `Add '${req}' to ${path || 'the root object'}.`
          });
        }
      }
    }

    const props = schema.properties || {};
    for (const [key, val] of Object.entries(data)) {
      const childPath = `${path}/${escapePointer(key)}`;
      if (key in props) {
        errors.push(...validateSchema(val, props[key], childPath));
      } else if (schema.additionalProperties === false) {
        errors.push({
          code: 'schema',
          path: childPath,
          message: `Unknown property '${key}'.`
        });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        errors.push(...validateSchema(val, schema.additionalProperties, childPath));
      }
    }
  }

  return errors;
}
