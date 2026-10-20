import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReading } from '../scanner.js';

const column = (values) => ({
  calories_kcal: null, energy_kj: null, protein_g: null, carbs_g: null, fat_g: null,
  fiber_g: null, sugar_g: null, sodium_mg: null, salt_g: null, ...values,
});

test('uses the per-100 g column when the label has one', () => {
  const result = normalizeReading({
    photo_status: 'readable',
    product_name: ' Greek Yogurt ',
    serving_size_g: 170,
    per_100g: column({ calories_kcal: 59, protein_g: 10.3, carbs_g: 3.6, fat_g: 0.4, fiber_g: 0, sugar_g: 3.2, sodium_mg: 36 }),
    per_serving: column({ calories_kcal: 100 }),
  });
  assert.equal(result.productName, 'Greek Yogurt');
  assert.equal(result.servingSizeG, 170);
  assert.deepEqual(result.per100, { calories: 59, protein: 10.3, carbs: 3.6, fat: 0.4, fiber: 0, sugar: 3.2, sodium: 36 });
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.convertedFromServing, []);
});

test('converts per-serving values to per 100 g', () => {
  const result = normalizeReading({
    photo_status: 'readable',
    product_name: 'Granola bar',
    serving_size_g: 40,
    per_100g: null,
    per_serving: column({ calories_kcal: 190, protein_g: 4, carbs_g: 25, fat_g: 8, fiber_g: 3, sugar_g: 11, sodium_mg: 95 }),
  });
  assert.deepEqual(result.per100, { calories: 475, protein: 10, carbs: 62.5, fat: 20, fiber: 7.5, sugar: 27.5, sodium: 238 });
  assert.equal(result.convertedFromServing.length, 7);
});

test('missing values stay null instead of being guessed', () => {
  const result = normalizeReading({
    photo_status: 'readable',
    product_name: null,
    serving_size_g: null,
    per_100g: column({ calories_kcal: 120, protein_g: 5, carbs_g: 20, fat_g: 2 }),
    per_serving: column({ fiber_g: 4 }), // can't convert: no serving size
  });
  assert.equal(result.productName, null);
  assert.equal(result.per100.fiber, null);
  assert.deepEqual(result.missing, ['fiber', 'sugar', 'sodium']);
});

test('converts kJ to kcal and salt to sodium', () => {
  const result = normalizeReading({
    photo_status: 'blurry',
    product_name: 'Oats',
    serving_size_g: 40,
    per_100g: column({ energy_kj: 1569, protein_g: 11, carbs_g: 60, fat_g: 8, salt_g: 0.02 }),
    per_serving: null,
  });
  assert.equal(result.per100.calories, 375);
  assert.equal(result.per100.sodium, 8);
  assert.equal(result.blurry, true);
});
