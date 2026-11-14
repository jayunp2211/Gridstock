import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NDA_VERSION, agreement, ndaAccepted } from './nda.ts';

test('a deal shows the version its two sides accepted, and a deal without one shows the current text', () => {
  assert.equal(agreement(NDA_VERSION).version, NDA_VERSION);
  assert.equal(agreement(null).version, NDA_VERSION);
  assert.equal(agreement('1999-01-01').version, NDA_VERSION);
  assert.ok(agreement().clauses.length > 5);
});

test('an acceptance counts once the deal carries the version of the text', () => {
  const at = '2026-11-14T10:00:00Z';
  assert.equal(ndaAccepted(null, { stage: 'nda', nda_version: null }), false);
  assert.equal(ndaAccepted(at, { stage: 'nda', nda_version: NDA_VERSION }), true);
  assert.equal(ndaAccepted(null, { stage: 'nda', nda_version: NDA_VERSION }), false);
});

test('an acceptance from before the agreement had a text is asked for again while the deal waits for the other side', () => {
  const at = '2026-11-01T10:00:00Z';
  assert.equal(ndaAccepted(at, { stage: 'nda', nda_version: null }), false);
  // It stands on a deal that both sides had already accepted.
  assert.equal(ndaAccepted(at, { stage: 'documents', nda_version: null }), true);
  assert.equal(ndaAccepted(at, { stage: 'closed', nda_version: null }), true);
});
