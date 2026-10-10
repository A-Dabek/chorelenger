export function ChallengeBanner({ challengeData, onExtra }) {
  if (!challengeData || !challengeData.challenge) return null;
  const { challenge, totalExtras = 0, extraCounts = {} } = challengeData;
  const goal = challenge.extraGoal || 20;
  const pct = Math.min(100, Math.round((totalExtras / goal) * 100));

  return (
    <div class="challenge-banner" title={challenge.description}>
      <div class="challenge-line">
        <span class="challenge-tag" title="Monthly Challenge">🏆</span>
        <span class="challenge-title">{challenge.title}</span>
        <span class="challenge-count">{totalExtras}/{goal}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style={{ width: `${pct}%` }} /></div>
      {challenge.extras?.length > 0 && (
        <div class="extra-buttons-list">
          {challenge.extras.map((ex) => (
            <button key={ex.id} class="extra-btn" type="button" title={ex.label} aria-label={ex.label} onClick={() => onExtra(ex)}>
              <span>{ex.icon}</span>
              <span class="extra-count">{extraCounts[ex.id] || 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
