export const MONTHLY_CHALLENGES = {
  1: {
    id: 'fresh-start',
    title: 'Fresh Start & Declutter',
    description: 'Kick off the year with a clean space and clear mind.',
    spotlightCategories: ['home', 'organize', 'cleaning'],
    extraGoal: 20,
    extras: [
      { id: 'quick-tidy', label: '10-min Tidy', icon: '✨' },
      { id: 'drink-water', label: 'Drink Water', icon: '💧' }
    ]
  },
  2: {
    id: 'cozy-habits',
    title: 'Cozy Habits & Well-being',
    description: 'Nurture warm routines and daily self-care.',
    spotlightCategories: ['health', 'self-care', 'home'],
    extraGoal: 20,
    extras: [
      { id: 'stretch', label: '5-min Stretch', icon: '🧘' },
      { id: 'tea-break', label: 'Mindful Break', icon: '🍵' }
    ]
  },
  3: {
    id: 'spring-awaken',
    title: 'Spring Awaken & Action',
    description: 'Bring fresh air and revitalizing movement into your days.',
    spotlightCategories: ['cleaning', 'outdoors', 'fitness'],
    extraGoal: 25,
    extras: [
      { id: 'walk', label: 'Quick Walk', icon: '👟' },
      { id: 'air-out', label: 'Air Out House', icon: '🪟' }
    ]
  },
  4: {
    id: 'deep-clean',
    title: 'Deep Clean & Refresh',
    description: 'Tackle the corners, dust the shelves, and refresh your space.',
    spotlightCategories: ['home', 'cleaning', 'maintenance'],
    extraGoal: 25,
    extras: [
      { id: 'wipe-surface', label: 'Wipe Counter', icon: '🧽' },
      { id: 'trash-out', label: 'Quick Bin Empty', icon: '🗑️' }
    ]
  },
  5: {
    id: 'sunshine-garden',
    title: 'Sunshine & Garden',
    description: 'Spend time with nature, plants, and the outdoors.',
    spotlightCategories: ['outdoors', 'plants', 'garden'],
    extraGoal: 25,
    extras: [
      { id: 'water-plants', label: 'Water Plants', icon: '🌱' },
      { id: 'sunshine', label: '10m Outside', icon: '☀️' }
    ]
  },
  6: {
    id: 'movement-adventure',
    title: 'Movement & Adventure',
    description: 'Stay active, ride out, and embrace summer momentum.',
    spotlightCategories: ['bike', 'fitness', 'outdoors', 'sports'],
    extraGoal: 30,
    extras: [
      { id: 'bike-ride', label: 'Bike Spin', icon: '🚲' },
      { id: 'hydrated', label: 'Hydrate', icon: '💧' }
    ]
  },
  7: {
    id: 'summer-energy',
    title: 'Summer Energy & Outdoors',
    description: 'Enjoy long daylight hours, animal companionship, and fresh air.',
    spotlightCategories: ['outdoors', 'dog', 'health'],
    extraGoal: 30,
    extras: [
      { id: 'pet-dog', label: 'Pet Dog', icon: '🐾' },
      { id: 'steps', label: '1k Steps', icon: '🚶' }
    ]
  },
  8: {
    id: 'focus-flow',
    title: 'Focus & Flow',
    description: 'Build calm consistency and dedicated daily focus.',
    spotlightCategories: ['habits', 'health', 'learning'],
    extraGoal: 25,
    extras: [
      { id: 'read-page', label: 'Read 5 Pages', icon: '📖' },
      { id: 'breathe', label: 'Deep Breath', icon: '🌬️' }
    ]
  },
  9: {
    id: 'routine-reset',
    title: 'Routine & Consistency',
    description: 'Reset your autumn rhythm and streamline daily tasks.',
    spotlightCategories: ['home', 'work', 'organization'],
    extraGoal: 25,
    extras: [
      { id: 'desk-clear', label: 'Clear Desk', icon: '🧹' },
      { id: 'plan-day', label: 'Quick Review', icon: '📝' }
    ]
  },
  10: {
    id: 'pets-nature',
    title: 'Month of the Pets & Outdoors',
    description: 'Focus on animal care, brisk walks, and spending quality time outside.',
    spotlightCategories: ['dog', 'pets', 'animal', 'outdoors', 'health'],
    extraGoal: 30,
    extras: [
      { id: 'pet-dog', label: 'Pet Dog', icon: '🐾' },
      { id: 'outside-time', label: 'Outside Time', icon: '🍂' }
    ]
  },
  11: {
    id: 'warmth-maintenance',
    title: 'Warmth & Maintenance',
    description: 'Prepare your home appliances and environment for winter.',
    spotlightCategories: ['maintenance', 'home', 'appliances'],
    extraGoal: 20,
    extras: [
      { id: 'appliance-check', label: 'Quick Check', icon: '🔧' },
      { id: 'hot-drink', label: 'Warm Drink', icon: '☕' }
    ]
  },
  12: {
    id: 'year-end-harmony',
    title: 'Year-End Harmony',
    description: 'Celebrate consistency, reflect on achievements, and close out the year.',
    spotlightCategories: ['home', 'family', 'self-care'],
    extraGoal: 20,
    extras: [
      { id: 'gratitude', label: 'Give Thanks', icon: '🎁' },
      { id: 'cozy-reset', label: '5-min Reset', icon: '🕯️' }
    ]
  }
};

export function getChallengeForMonth(monthStr) {
  let monthNum = 1;
  if (typeof monthStr === 'number') {
    monthNum = monthStr;
  } else if (typeof monthStr === 'string' && monthStr.includes('-')) {
    const [, m] = monthStr.split('-');
    monthNum = Number(m) || 1;
  } else if (typeof monthStr === 'string') {
    monthNum = Number(monthStr) || 1;
  }
  return MONTHLY_CHALLENGES[monthNum] || MONTHLY_CHALLENGES[1];
}
