import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bmr, calculateTargets, amountsForGrams, sumEntries } from '../public/nutrition.js';

test('BMR uses Mifflin-St Jeor', () => {
  assert.equal(bmr({ weight: 80, height: 180, age: 30, sex: 'male' }), 1780);
  assert.equal(bmr({ weight: 60, height: 165, age: 30, sex: 'female' }), 1320.25);
});

test('targets for a moderately active man maintaining weight', () => {
  const { targets, steps } = calculateTargets({ weight: 80, height: 180, age: 30, sex: 'male', activity: 'moderate', goal: 'maintain' });
  assert.equal(steps.tdee, 2759);
  assert.deepEqual(targets, { calories: 2759, protein: 144, carbs: 373, fat: 77, fiber: 39 });
});

test('fat loss lowers calories and raises protein', () => {
  const maintain = calculateTargets({ weight: 80, height: 180, age: 30, sex: 'male', activity: 'moderate', goal: 'maintain' }).targets;
  const lose = calculateTargets({ weight: 80, height: 180, age: 30, sex: 'male', activity: 'moderate', goal: 'lose' }).targets;
  assert.ok(lose.calories < maintain.calories);
  assert.ok(lose.protein > maintain.protein);
});

test('amounts scale from per-100 g to grams eaten', () => {
  const per100 = { calories: 59, protein: 10.3, carbs: 3.6, fat: 0.4, fiber: 0 };
  assert.deepEqual(amountsForGrams(per100, 170), { calories: 100.3, protein: 17.5, carbs: 6.1, fat: 0.7, fiber: 0 });
});

test('sumEntries adds up the day', () => {
  const a = { amounts: { calories: 100, protein: 10, carbs: 5, fat: 2, fiber: 1 } };
  const b = { amounts: { calories: 50.5, protein: 1.2, carbs: 10, fat: 0, fiber: 2.3 } };
  assert.deepEqual(sumEntries([a, b]), { calories: 150.5, protein: 11.2, carbs: 15, fat: 2, fiber: 3.3 });
});
