// node --test scripts/lib/segments.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { segmentName, segmentsForBbox } from './segments.mjs';

test('names squares after their south-west corner', () => {
  assert.equal(segmentName(105, -10), 'E105_S10.rd5');
  assert.equal(segmentName(0, 0), 'E0_N0.rd5');
  assert.equal(segmentName(-125, 45), 'W125_N45.rd5');
  assert.equal(segmentName(5, 45), 'E5_N45.rd5');
});

test('Singapore sits in one square, Switzerland in two (S7 measured the same counts)', () => {
  assert.deepEqual(segmentsForBbox([103.6404, 1.2643, 104.0034, 1.4486]), ['E100_N0.rd5']);
  assert.deepEqual(segmentsForBbox([5.9559, 45.818, 10.4921, 47.8084]), ['E5_N45.rd5', 'E10_N45.rd5']);
});

test('Jakarta and Surabaya are in different squares; a route box spans both', () => {
  assert.deepEqual(segmentsForBbox([106.8, -6.2, 112.8, -7.3]), ['E105_S10.rd5', 'E110_S10.rd5']);
});

test('a box edge exactly on a boundary does not add the next square', () => {
  assert.deepEqual(segmentsForBbox([100, 0, 105, 5]), ['E100_N0.rd5']);
  assert.deepEqual(segmentsForBbox([100, 0, 105.0001, 5]), ['E100_N0.rd5', 'E105_N0.rd5']);
});

test('boxes across the equator and the prime meridian cover both sides', () => {
  assert.deepEqual(segmentsForBbox([-2, -2, 2, 2]), ['W5_S5.rd5', 'E0_S5.rd5', 'W5_N0.rd5', 'E0_N0.rd5']);
});
