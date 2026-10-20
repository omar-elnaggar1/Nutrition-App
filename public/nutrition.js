// All the nutrition math lives here, separate from the screens,
// so it's easy to read, test, and change.

export const ACTIVITY_LEVELS = {
  sedentary: { label: 'Sedentary (desk job, little exercise)', factor: 1.2 },
  light: { label: 'Lightly active (exercise 1–3 days/week)', factor: 1.375 },
  moderate: { label: 'Moderately active (exercise 3–5 days/week)', factor: 1.55 },
  very: { label: 'Very active (hard exercise 6–7 days/week)', factor: 1.725 },
  extra: { label: 'Extra active (physical job + training)', factor: 1.9 },
};

export const GOALS = {
  gain: { label: 'Lean muscle gain', calorieMultiplier: 1.1, proteinPerKg: 2.0, note: '+10% calories' },
  maintain: { label: 'Maintain', calorieMultiplier: 1.0, proteinPerKg: 1.8, note: 'no change' },
  lose: { label: 'Lose fat', calorieMultiplier: 0.8, proteinPerKg: 2.2, note: '−20% calories' },
};

export const FAT_SHARE = 0.25; // 25% of calories come from fat
export const FIBER_PER_1000_KCAL = 14; // grams of fiber per 1000 kcal

export const NUTRIENTS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
];

/** Mifflin-St Jeor equation: calories your body burns at complete rest. */
export function bmr({ weight, height, age, sex }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

/**
 * Turns a profile into daily targets.
 * Returns the targets plus every intermediate step, so the app can show its work.
 */
export function calculateTargets(profile) {
  const activity = ACTIVITY_LEVELS[profile.activity];
  const goal = GOALS[profile.goal];
  if (!activity || !goal) throw new Error('Unknown activity level or goal');

  const bmrValue = bmr(profile);
  const tdee = bmrValue * activity.factor;
  const calories = Math.round(tdee * goal.calorieMultiplier);
  const protein = Math.round(profile.weight * goal.proteinPerKg);
  const fat = Math.round((calories * FAT_SHARE) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((calories / 1000) * FIBER_PER_1000_KCAL);

  return {
    targets: { calories, protein, carbs, fat, fiber },
    steps: { bmr: Math.round(bmrValue), tdee: Math.round(tdee), activity, goal },
  };
}

/** Scales "per 100 g" values to the grams you actually ate. */
export function amountsForGrams(per100, grams) {
  const result = {};
  for (const { key } of NUTRIENTS) {
    const value = ((Number(per100[key]) || 0) * grams) / 100;
    result[key] = Math.round(value * 10) / 10; // one decimal place
  }
  return result;
}

/** Adds up a list of log entries into daily totals. */
export function sumEntries(entries) {
  const totals = Object.fromEntries(NUTRIENTS.map(({ key }) => [key, 0]));
  for (const entry of entries) {
    for (const { key } of NUTRIENTS) totals[key] += entry.amounts[key] || 0;
  }
  for (const key of Object.keys(totals)) totals[key] = Math.round(totals[key] * 10) / 10;
  return totals;
}
