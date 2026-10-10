import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isChoreSpotlighted,
  getSpotlightChoreIds,
  calculateExpectedChoreOccurrences,
  calculateMonthlyExecution,
  calculateRewardStatus,
  evaluateAchievements
} from './motivation.js';
import { getChallengeForMonth } from './challenges.config.js';

test('spotlight matching matches category or name', () => {
  const challenge = {
    spotlightCategories: ['dog', 'outdoors', 'health']
  };

  assert.equal(isChoreSpotlighted({ name: 'Brush fur', category: 'Dog care' }, challenge), true);
  assert.equal(isChoreSpotlighted({ name: 'Walk dog', category: 'General' }, challenge), true);
  assert.equal(isChoreSpotlighted({ name: 'Clean dishes', category: 'Home' }, challenge), false);

  const chores = [
    { id: 1, name: 'Brush fur', category: 'dog' },
    { id: 2, name: 'Vacuum', category: 'home' },
    { id: 3, name: 'Hike', category: 'outdoors' }
  ];
  assert.deepEqual(getSpotlightChoreIds(chores, challenge), [1, 3]);
});

test('calculateExpectedChoreOccurrences handles interval, flexible, calendar types', () => {
  // Daily chore for October (31 days)
  const daily = { type: 'interval', interval_n: 1, interval_unit: 'day', start_date: '2026-10-01' };
  assert.equal(calculateExpectedChoreOccurrences(daily, '2026-10'), 31);

  // Daily chore started mid-month (e.g. Oct 16 to Oct 31 = 16 days)
  const dailyMid = { type: 'interval', interval_n: 1, interval_unit: 'day', start_date: '2026-10-16' };
  assert.equal(calculateExpectedChoreOccurrences(dailyMid, '2026-10'), 16);

  // Weekly chore (every 1 week in 31 days = 31 / 7 approx 4.428)
  const weekly = { type: 'interval', interval_n: 1, interval_unit: 'week', start_date: '2026-10-01' };
  assert.equal(Math.round(calculateExpectedChoreOccurrences(weekly, '2026-10') * 10) / 10, 4.4);

  // Monthly chore
  const monthly = { type: 'interval', interval_n: 1, interval_unit: 'month', start_date: '2026-10-01' };
  assert.equal(calculateExpectedChoreOccurrences(monthly, '2026-10'), 1);

  // Future chore started after month
  const future = { type: 'interval', interval_n: 1, interval_unit: 'day', start_date: '2026-11-01' };
  assert.equal(calculateExpectedChoreOccurrences(future, '2026-10'), 0);

  // Calendar chore in October
  const calOct = { type: 'calendar', cal_month: 10, cal_day: 15, start_date: '2026-01-01' };
  assert.equal(calculateExpectedChoreOccurrences(calOct, '2026-10'), 1);

  // Calendar chore in May checked for October
  const calMay = { type: 'calendar', cal_month: 5, cal_day: 15, start_date: '2026-01-01' };
  assert.equal(calculateExpectedChoreOccurrences(calMay, '2026-10'), 0);
});

test('calculateMonthlyExecution evaluates completion rate and base reward threshold (95%)', () => {
  // 20 expected completions
  const chores = [
    { id: 1, type: 'interval', interval_n: 1, interval_unit: 'day', start_date: '2026-10-01' } // 31 expected
  ];

  // If 30 completed out of 31: 30 / 31 = 0.9677 >= 0.95 -> achieved
  const completions30 = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    chore_id: 1,
    done_date: `2026-10-${String(i + 1).padStart(2, '0')}`
  }));

  const res30 = calculateMonthlyExecution(chores, completions30, '2026-10');
  assert.equal(res30.completed, 30);
  assert.equal(res30.expected, 31);
  assert.equal(res30.baseRewardAchieved, true);
  assert.equal(res30.executionRate, 0.97);

  // If 28 completed out of 31: 28 / 31 = 0.903 < 0.95 -> not achieved
  const completions28 = completions30.slice(0, 28);
  const res28 = calculateMonthlyExecution(chores, completions28, '2026-10');
  assert.equal(res28.completed, 28);
  assert.equal(res28.baseRewardAchieved, false);
});

test('calculateRewardStatus computes base and extra reward flags correctly', () => {
  assert.deepEqual(
    calculateRewardStatus({ executionRate: 0.96, totalExtras: 30, extraGoal: 30 }),
    {
      executionRate: 0.96,
      baseRewardAchieved: true,
      extraRewardAchieved: true,
      extraCurrent: 30,
      extraGoal: 30
    }
  );

  assert.deepEqual(
    calculateRewardStatus({ executionRate: 0.90, totalExtras: 15, extraGoal: 30 }),
    {
      executionRate: 0.90,
      baseRewardAchieved: false,
      extraRewardAchieved: false,
      extraCurrent: 15,
      extraGoal: 30
    }
  );
});

test('evaluateAchievements unlocks badges based on history milestones', () => {
  const chores = [
    { id: 1, name: 'Chore A', category: 'home' },
    { id: 2, name: 'Chore B', category: 'dog' },
    { id: 3, name: 'Chore C', category: 'health' }
  ];

  // 7-day streak across 3 categories
  const completions = [
    { chore_id: 1, done_date: '2026-10-01' },
    { chore_id: 2, done_date: '2026-10-02' },
    { chore_id: 3, done_date: '2026-10-03' },
    { chore_id: 1, done_date: '2026-10-04' },
    { chore_id: 2, done_date: '2026-10-05' },
    { chore_id: 3, done_date: '2026-10-06' },
    { chore_id: 1, done_date: '2026-10-07' }
  ];

  const extraCompletions = [
    { month: '2026-10', extra_id: 'pet-dog', done_date: '2026-10-02' }
  ];

  const monthlyRates = [
    { month: '2026-08', expected: 10, completed: 10, rawRate: 1.0 },
    { month: '2026-09', expected: 10, completed: 10, rawRate: 1.0 },
    { month: '2026-10', expected: 10, completed: 10, rawRate: 1.0 }
  ];

  const achievements = evaluateAchievements({
    chores,
    completions,
    extraCompletions,
    monthlyRates
  });

  const getAch = (id) => achievements.find((a) => a.id === id);

  assert.equal(getAch('first-chore').unlocked, true);
  assert.equal(getAch('first-chore').unlockedAt, '2026-10-01');

  assert.equal(getAch('five-chores').unlocked, true);
  assert.equal(getAch('five-chores').unlockedAt, '2026-10-05');

  assert.equal(getAch('clean-streak-7').unlocked, true);
  assert.equal(getAch('clean-streak-7').unlockedAt, '2026-10-07');

  assert.equal(getAch('variety-pack').unlocked, true);
  assert.equal(getAch('variety-pack').unlockedAt, '2026-10-03');

  assert.equal(getAch('discipline-95').unlocked, true);
  assert.equal(getAch('discipline-master').unlocked, true);
  assert.equal(getAch('extra-starter').unlocked, true);
  assert.equal(getAch('century-club').unlocked, false);
});
