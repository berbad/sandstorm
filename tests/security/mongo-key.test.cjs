const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Evaluate the actual pure helpers without initializing Meteor or a database.
const source = readFileSync(join(__dirname, '../../shell/imports/sandstorm-db/db.js'), 'utf8');
const start = source.indexOf('SandstormDb.escapeMongoKey =');
const end = source.indexOf('\nfunction appNameFromPackage', start);
assert.ok(start >= 0 && end > start, 'database escaping helpers must be present');
const context = vm.createContext({ SandstormDb: {}, Array });
vm.runInContext(source.slice(start, end), context);
const { escapeMongoKey, escapeMongoObject } = context.SandstormDb;

test('escapes every Mongo key delimiter, including adjacent and repeated characters', () => {
  assert.equal(escapeMongoKey('a.b.c$$.$d'), 'a\uFF0Eb\uFF0Ec\uFF04\uFF04\uFF0E\uFF04d');
  assert.equal(escapeMongoKey('$$..'), '\uFF04\uFF04\uFF0E\uFF0E');
});

test('preserves safe keys, empty keys, and the established fullwidth encoding', () => {
  assert.equal(escapeMongoKey('safe/key-name_123'), 'safe/key-name_123');
  assert.equal(escapeMongoKey(''), '');
  assert.equal(escapeMongoKey('\uFF04already\uFF0Eescaped'), '\uFF04already\uFF0Eescaped');
});

test('escapes nested object and array keys without modifying string values', () => {
  const input = { 'a.b.c': [{ '$x$y': 'a.b$c' }], plain: null };
  assert.equal(JSON.stringify(escapeMongoObject(input)),
    '{"a\uFF0Eb\uFF0Ec":[{"\uFF04x\uFF04y":"a.b$c"}],"plain":null}');
  assert.equal(JSON.stringify(input), '{"a.b.c":[{"$x$y":"a.b$c"}],"plain":null}');
});
