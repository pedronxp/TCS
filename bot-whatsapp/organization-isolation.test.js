'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sameOrganization } = require('./organization-isolation');

test('aceita somente identificadores da mesma organização', () => {
  assert.equal(sameOrganization('org-a', 'org-a', 'org-a'), true);
});

test('recusa organizações diferentes', () => {
  assert.equal(sameOrganization('org-a', 'org-b'), false);
});

test('recusa identificadores ausentes', () => {
  assert.equal(sameOrganization('org-a', null), false);
  assert.equal(sameOrganization('', ''), false);
});
