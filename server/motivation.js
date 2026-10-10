import { diffDays } from './schedule.js';
import { getChallengeForMonth } from './challenges.config.js';

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isChoreSpotlighted(chore, challenge) {
  if (!chore || !challenge || !Array.isArray(challenge.spotlightCategories)) return false;
  const cats = challenge.spotlightCategories.map((c) => c.toLowerCase());
  const choreCat = (chore.category || '').toLowerCase();
  const choreName = (chore.name || '').toLowerCase();
  return cats.some((cat) => choreCat.includes(cat) || choreName.includes(cat));
}

export function getSpotlightChoreIds(chores, challenge) {
  if (!Array.isArray(chores) || !challenge) return [];
  return chores.filter((c) => isChoreSpotlighted(c, challenge)).map((c) => c.id);
}

export function calculateExpectedChoreOccurrences(chore, monthStr) {
  const [yearNum, monthNum] = monthStr.split('-').map(Number);
  const numDays = daysInMonth(yearNum, monthNum);
  const p = (n) => String(n).padStart(2, '0');
  const monthStart = `${yearNum}-${p(monthNum)}-01`;
  const monthEnd = `${yearNum}-${p(monthNum)}-${p(numDays)}`;

  if (chore.start_date > monthEnd) return 0;

  if (chore.type === 'one_off') {
    return chore.start_date >= monthStart ? 1 : 0;
  }

  if (chore.type === 'calendar') {
    if (chore.cal_month !== monthNum) return 0;
    const targetDay = Math.min(chore.cal_day || 1, numDays);
    const dateStr = `${yearNum}-${p(monthNum)}-${p(targetDay)}`;
    return dateStr >= chore.start_date ? 1 : 0;
  }

  const activeStart = chore.start_date > monthStart ? chore.start_date : monthStart;
  const activeDays = diffDays(monthEnd, activeStart) + 1;
  if (activeDays <= 0) return 0;

  const intervalN = chore.interval_n || 1;
  const unit = chore.interval_unit || 'day';

  if (unit === 'day') {
    return activeDays / intervalN;
  }
  if (unit === 'week') {
    return activeDays / (intervalN * 7);
  }
  if (unit === 'month') {
    return (activeDays / numDays) * (1 / intervalN);
  }
  return 0;
}

export function calculateMonthlyExecution(chores = [], completions = [], monthStr) {
  const completionsInMonth = completions.filter((c) => (c.done_date || '').startsWith(monthStr));
  let totalExpected = 0;

  for (const chore of chores) {
    totalExpected += calculateExpectedChoreOccurrences(chore, monthStr);
  }

  const completed = completionsInMonth.length;
  if (totalExpected === 0) {
    return {
      month: monthStr,
      expected: 0,
      completed,
      executionRate: completed > 0 || chores.length === 0 ? 1.0 : 0.0,
      rawRate: completed > 0 || chores.length === 0 ? 1.0 : 0.0,
      baseRewardAchieved: true
    };
  }

  const rawRate = completed / totalExpected;
  const executionRate = Math.min(1.0, rawRate);
  const baseRewardAchieved = rawRate >= 0.95;

  return {
    month: monthStr,
    expected: Math.round(totalExpected * 10) / 10,
    completed,
    executionRate: Math.round(executionRate * 100) / 100,
    rawRate: Math.round(rawRate * 1000) / 1000,
    baseRewardAchieved
  };
}

export function calculateRewardStatus({ executionRate = 0, totalExtras = 0, extraGoal = 20 }) {
  const baseRewardAchieved = executionRate >= 0.95;
  const extraRewardAchieved = totalExtras >= extraGoal;
  return {
    executionRate,
    baseRewardAchieved,
    extraRewardAchieved,
    extraCurrent: totalExtras,
    extraGoal
  };
}

export const ACHIEVEMENTS_DEFINITIONS = [
  {
    id: 'first-chore',
    name: 'First Step',
    desc: 'Completed your first chore',
    icon: '🌱'
  },
  {
    id: 'five-chores',
    name: 'High Five',
    desc: 'Completed 5 chores in total',
    icon: '✋'
  },
  {
    id: 'clean-streak-7',
    name: 'Clean Week',
    desc: 'Maintained a 7-day chore completion streak',
    icon: '🔥'
  },
  {
    id: 'discipline-95',
    name: '95% Club',
    desc: 'Achieved ≥95% chore execution for a month',
    icon: '🎯'
  },
  {
    id: 'discipline-master',
    name: 'Discipline Master',
    desc: 'Achieved ≥95% monthly execution for 3 consecutive months',
    icon: '👑'
  },
  {
    id: 'extra-starter',
    name: 'Extra Effort',
    desc: 'Tapped your first challenge extra button',
    icon: '⚡'
  },
  {
    id: 'extra-enthusiast',
    name: 'Challenge Champion',
    desc: 'Met or exceeded the monthly extra challenge goal',
    icon: '🏆'
  },
  {
    id: 'variety-pack',
    name: 'Renaissance Doer',
    desc: 'Completed chores across 3 or more distinct categories',
    icon: '🎨'
  },
  {
    id: 'century-club',
    name: 'Century Club',
    desc: 'Completed 100 chores in total',
    icon: '💯'
  }
];

export function evaluateAchievements({
  chores = [],
  completions = [],
  extraCompletions = [],
  monthlyRates = []
} = {}) {
  const sortedCompletions = [...completions].sort((a, b) => a.done_date.localeCompare(b.done_date));
  const sortedExtras = [...extraCompletions].sort((a, b) => a.done_date.localeCompare(b.done_date));

  const unlockedMap = {};

  // 1. first-chore
  if (sortedCompletions.length >= 1) {
    unlockedMap['first-chore'] = sortedCompletions[0].done_date;
  }

  // 2. five-chores
  if (sortedCompletions.length >= 5) {
    unlockedMap['five-chores'] = sortedCompletions[4].done_date;
  }

  // 3. century-club
  if (sortedCompletions.length >= 100) {
    unlockedMap['century-club'] = sortedCompletions[99].done_date;
  }

  // 4. clean-streak-7
  const uniqueDates = Array.from(new Set(sortedCompletions.map((c) => c.done_date))).sort();
  let currentStreak = 0;
  let streakEnd = null;
  for (let i = 0; i < uniqueDates.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const prev = uniqueDates[i - 1];
      const curr = uniqueDates[i];
      if (diffDays(curr, prev) === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    }
    if (currentStreak >= 7 && !streakEnd) {
      streakEnd = uniqueDates[i];
      break;
    }
  }
  if (streakEnd) {
    unlockedMap['clean-streak-7'] = streakEnd;
  }

  // 5. discipline-95
  const validRates = monthlyRates.filter((m) => m.expected > 0 && m.rawRate >= 0.95);
  if (validRates.length > 0) {
    unlockedMap['discipline-95'] = validRates[0].month;
  }

  // 6. discipline-master (3 consecutive months)
  const sortedMonths = [...monthlyRates].sort((a, b) => a.month.localeCompare(b.month));
  let masterStreak = 0;
  let masterEnd = null;
  for (let i = 0; i < sortedMonths.length; i++) {
    const m = sortedMonths[i];
    if (m.expected > 0 && m.rawRate >= 0.95) {
      if (i > 0) {
        const [py, pm] = sortedMonths[i - 1].month.split('-').map(Number);
        const [cy, cm] = m.month.split('-').map(Number);
        const isConsecutive = (cy * 12 + cm) - (py * 12 + pm) === 1;
        if (isConsecutive && masterStreak > 0) {
          masterStreak++;
        } else {
          masterStreak = 1;
        }
      } else {
        masterStreak = 1;
      }
      if (masterStreak >= 3 && !masterEnd) {
        masterEnd = m.month;
        break;
      }
    } else {
      masterStreak = 0;
    }
  }
  if (masterEnd) {
    unlockedMap['discipline-master'] = masterEnd;
  }

  // 7. extra-starter
  if (sortedExtras.length >= 1) {
    unlockedMap['extra-starter'] = sortedExtras[0].done_date;
  }

  // 8. extra-enthusiast
  // Group extras by month
  const extrasByMonth = {};
  for (const ex of sortedExtras) {
    const m = ex.month || ex.done_date.slice(0, 7);
    extrasByMonth[m] = (extrasByMonth[m] || 0) + 1;
  }
  for (const [m, count] of Object.entries(extrasByMonth)) {
    const challenge = getChallengeForMonth(m);
    if (count >= challenge.extraGoal) {
      unlockedMap['extra-enthusiast'] = m;
      break;
    }
  }

  // 9. variety-pack (3 distinct categories with completions)
  const choreCategoryMap = new Map(chores.map((c) => [c.id, (c.category || '').trim().toLowerCase()]));
  const completedCategories = new Set();
  let varietyUnlockDate = null;
  for (const comp of sortedCompletions) {
    const cat = choreCategoryMap.get(comp.chore_id);
    if (cat) {
      completedCategories.add(cat);
      if (completedCategories.size >= 3 && !varietyUnlockDate) {
        varietyUnlockDate = comp.done_date;
        break;
      }
    }
  }
  if (varietyUnlockDate) {
    unlockedMap['variety-pack'] = varietyUnlockDate;
  }

  return ACHIEVEMENTS_DEFINITIONS.map((ach) => ({
    ...ach,
    unlocked: Boolean(unlockedMap[ach.id]),
    unlockedAt: unlockedMap[ach.id] || null
  }));
}
