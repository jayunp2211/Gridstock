import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCEPT, MAX_FILE_BYTES, ONE_SHOT_BYTES, PART_BYTES, cleanName, fileError, fileSize, fileType, mayAdd, mayOpen, partSize, partsFor,
  type Access,
} from './files.ts';

const MB = 1024 * 1024;

test('only listed kinds of file are accepted, by extension and in any letter case', () => {
  assert.equal(fileType('Submittal rev C.pdf'), 'application/pdf');
  assert.equal(fileType('NAMEPLATE.JPG'), 'image/jpeg');
  assert.equal(fileType('single-line.dwg'), 'application/acad');
  assert.equal(fileType('test report.xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('anything a browser could run or render as a page is refused', () => {
  for (const name of ['page.html', 'drawing.svg', 'run.exe', 'script.js', 'report.pdf.exe', 'archive.zip', 'macro.xlsm', 'noextension', '.pdf.', ''])
    assert.equal(fileType(name), null, name);
});

test('the file picker offers exactly the accepted extensions', () => {
  for (const ext of ACCEPT.split(',')) assert.notEqual(fileType(`x${ext}`), null, ext);
});

test('a name loses its folder path and anything that is not safe in a file name', () => {
  assert.equal(cleanName('C:\\Users\\dana\\Desktop\\Submittal.pdf'), 'Submittal.pdf');
  assert.equal(cleanName('../../etc/passwd'), 'passwd');
  assert.equal(cleanName('  test\treport\n<final>:"v2"|?*.pdf '), 'test report finalv2.pdf');
  assert.equal(cleanName('one\nline/two\\Report.PDF'), 'Report.PDF');
  assert.equal(cleanName('\u0000\u0007'), '');
});

test('a long name is cut to 120 characters and keeps its extension', () => {
  const name = cleanName('a'.repeat(300) + '.pdf');
  assert.equal(name.length, 120);
  assert.ok(name.endsWith('.pdf'));
  assert.equal(fileType(name), 'application/pdf');
});

test('a file travels in parts that add up to exactly its size', () => {
  for (const size of [1, PART_BYTES - 1, PART_BYTES, PART_BYTES + 1, 2 * PART_BYTES, MAX_FILE_BYTES]) {
    const parts = partsFor(size);
    let total = 0;
    for (let seq = 0; seq < parts; seq++) {
      const n = partSize(size, seq);
      assert.ok(n > 0 && n <= PART_BYTES, `part ${seq} of ${size}`);
      total += n;
    }
    assert.equal(total, size);
  }
  assert.equal(partsFor(1), 1);
  assert.equal(partsFor(PART_BYTES), 1);
  assert.equal(partsFor(PART_BYTES + 1), 2);
  assert.equal(partsFor(MAX_FILE_BYTES), 5);
});

test('the limits stay inside what the host carries in one request and one download', () => {
  // About 4.5 MB of binary data in a request, and 20 MB in a streamed response.
  assert.ok(PART_BYTES <= 4 * MB);
  assert.ok(ONE_SHOT_BYTES <= 4 * MB);
  assert.ok(MAX_FILE_BYTES <= 18 * MB);
});

test('sizes read the way people say them', () => {
  assert.equal(fileSize(300), '1 KB');
  assert.equal(fileSize(860_160), '840 KB');
  assert.equal(fileSize(2.4 * MB), '2.4 MB');
  assert.equal(fileSize(15 * MB), '15 MB');
});

test('an unknown error code gets the general message, never text from the request', () => {
  assert.equal(fileError('<script>'), fileError('failed'));
  assert.equal(fileError('constructor'), fileError('failed'));
  assert.match(fileError('size'), /15 MB/);
});

const room = (role: Access['role'], stage = 'documents', signed = true): Access => ({ role, stage, signed });
const real = { uploaded_by: 'seller-1', visitor: null };
const demo = { uploaded_by: 'seller-1', visitor: 'browser-a' };

test('the two sides add documents after the NDA and until the deal ends', () => {
  assert.equal(mayAdd(room('buyer')), true);
  assert.equal(mayAdd(room('seller', 'escrow')), true);
  assert.equal(mayAdd(room('buyer', 'nda', false)), false);
  assert.equal(mayAdd(room('seller', 'closed')), false);
  assert.equal(mayAdd(room('seller', 'lost')), false);
  assert.equal(mayAdd(room('admin')), false);
});

test('a document opens for both sides and for operations once the NDA is accepted', () => {
  assert.equal(mayOpen(room('buyer'), 'buyer-1', real, null), true);
  assert.equal(mayOpen(room('seller'), 'seller-1', real, null), true);
  assert.equal(mayOpen(room('admin'), 'ops', real, null), true);
  assert.equal(mayOpen(room('buyer', 'nda', false), 'buyer-1', real, null), false);
  assert.equal(mayOpen(room('buyer', 'closed'), 'buyer-1', real, null), true);
});

test('after a deal ends without a sale, each side keeps only its own documents', () => {
  assert.equal(mayOpen(room('buyer', 'lost'), 'buyer-1', real, null), false);
  assert.equal(mayOpen(room('seller', 'lost'), 'seller-1', real, null), true);
  assert.equal(mayOpen(room('admin', 'lost'), 'ops', real, null), true);
});

test('a demo file opens only in the browser that added it, whichever account asks', () => {
  assert.equal(mayOpen(room('seller'), 'seller-1', demo, 'browser-a'), true);
  assert.equal(mayOpen(room('buyer'), 'buyer-1', demo, 'browser-a'), true);
  assert.equal(mayOpen(room('seller'), 'seller-1', demo, 'browser-b'), false);
  assert.equal(mayOpen(room('buyer'), 'buyer-1', demo, null), false);
  assert.equal(mayOpen(room('admin'), 'ops', demo, 'browser-b'), false);
});
