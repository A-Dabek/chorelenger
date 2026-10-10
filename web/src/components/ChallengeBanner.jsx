export function ChallengeBanner({ challengeData, onExtra }) {
  if (!challengeData || !challengeData.challenge) return null;
  const { challenge, totalExtras = 0, extraCounts = {} } = challengeData;
  const goal = challenge.extraGoal || 20;
  const pct = Math.min(100, Math.round((totalExtras / goal) * 100));

  return (
    <div class="challenge-banner">
      <div class="challenge-tag">Monthly Challenge</div>
      <div class="challenge-title">{challenge.title}</div>
      <div class="challenge-desc">{challenge.description}</div>
      <div class="challenge-progress">
        <div class="progress-header">
          <span>Extra Actions Goal</span>
          <span>{totalExtras} / {goal} ({pct}%)</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {challenge.extras?.length > 0 && (
        <div class="extra-buttons-section">
          <div class="extra-buttons-label">Quick Extras</div>
          <div class="extra-buttons-list">
            {challenge.extras.map((ex) => (
              <button key={ex.id} class="extra-btn" type="button" onClick={() => onExtra(ex)}>
                <span>{ex.icon}</span>
                <span>{ex.label}</span>
                <span class="extra-count">{extraCounts[ex.id] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
