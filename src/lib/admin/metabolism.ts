/**
 * Metabolic calculations for the professional's diet workflow.
 *
 * Mirrors the iOS app's Mifflin-St Jeor implementation (DietViewModel.swift)
 * but fixes its known bug: the app hardcodes age = 25. Here we derive age from
 * the profile's birth_year, so prescriptions are actually accurate.
 */

export type Gender = 'male' | 'female';
export type Goal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel = 'sedentary' | 'active' | 'heavy';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  active: 1.375,
  heavy: 1.55,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentário',
  active: 'Ativo',
  heavy: 'Muito ativo',
};

export const GOAL_LABEL: Record<Goal, string> = {
  lose: 'Emagrecimento',
  maintain: 'Manutenção',
  gain: 'Hipertrofia',
};

/** kcal adjustment applied to TDEE per goal (matches app: ±400). */
export const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose: -400,
  maintain: 0,
  gain: 400,
};

export interface MetabolismInput {
  gender: Gender;
  weightKg: number;
  heightCm: number;
  age: number;
  activity: ActivityLevel;
  goal: Goal;
  /** grams of protein per kg of bodyweight (default 2.0). */
  proteinPerKg?: number;
  /** fraction of total calories from fat (default 0.25). */
  fatPct?: number;
}

export interface MacroTargets {
  protein: number; // grams
  fat: number; // grams
  carbs: number; // grams
  proteinKcal: number;
  fatKcal: number;
  carbsKcal: number;
}

export interface MetabolismResult {
  bmr: number; // basal metabolic rate
  tdee: number; // total daily energy expenditure
  target: number; // goal-adjusted calorie target
  macros: MacroTargets;
}

export function ageFromBirthYear(birthYear?: number | null, currentYear = new Date().getFullYear()): number | null {
  if (!birthYear || birthYear < 1900 || birthYear > currentYear) return null;
  return currentYear - birthYear;
}

export function computeBmr(input: Pick<MetabolismInput, 'gender' | 'weightKg' | 'heightCm' | 'age'>): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.gender === 'male' ? base + 5 : base - 161;
}

export function computeMacros(target: number, weightKg: number, proteinPerKg = 2.0, fatPct = 0.25): MacroTargets {
  const proteinG = Math.round(proteinPerKg * weightKg);
  const proteinKcal = proteinG * 4;
  const fatKcal = Math.round(target * fatPct);
  const fatG = Math.round(fatKcal / 9);
  const carbsKcal = Math.max(0, target - proteinKcal - fatKcal);
  const carbsG = Math.round(carbsKcal / 4);
  return {
    protein: proteinG,
    fat: fatG,
    carbs: carbsG,
    proteinKcal,
    fatKcal,
    carbsKcal,
  };
}

export function computeMetabolism(input: MetabolismInput): MetabolismResult {
  const bmr = computeBmr(input);
  const tdee = bmr * ACTIVITY_FACTORS[input.activity];
  const target = Math.round(tdee + GOAL_ADJUSTMENT[input.goal]);
  const macros = computeMacros(target, input.weightKg, input.proteinPerKg ?? 2.0, input.fatPct ?? 0.25);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target,
    macros,
  };
}
