const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePassword } = require('./reset-password.cjs');

test('explica cuando la contraseña es demasiado corta', () => {
  assert.throws(() => validatePassword('a'.repeat(11), 'a'.repeat(11)), /demasiado corta/);
});
test('distingue la confirmación diferente', () => {
  assert.throws(() => validatePassword('a'.repeat(12), 'b'.repeat(12)), /no coinciden/);
});
test('limita bytes UTF-8 para evitar truncamiento de bcrypt', () => {
  assert.throws(() => validatePassword('á'.repeat(37), 'á'.repeat(37)), /72 bytes/);
  assert.doesNotThrow(() => validatePassword('á'.repeat(36), 'á'.repeat(36)));
});
test('acepta los límites de longitud', () => {
  for (const length of [12, 72]) {
    assert.doesNotThrow(() => validatePassword('a'.repeat(length), 'a'.repeat(length)));
  }
  assert.throws(() => validatePassword('a'.repeat(73), 'a'.repeat(73)), /72 bytes/);
});
test('respeta espacios y mayúsculas de la contraseña elegida', () => {
  const value = ' A'.repeat(6);
  assert.doesNotThrow(() => validatePassword(value, value));
  assert.throws(() => validatePassword(value, value.trim()), /no coinciden/);
  assert.throws(() => validatePassword(value, value.toLowerCase()), /no coinciden/);
});
