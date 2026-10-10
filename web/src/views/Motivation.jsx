import { useState, useEffect } from 'preact/hooks';
import { api } from '../api.js';
import { localMonth } from '../lib/dates.js';

export function MotivationView() {
  const [month, setMonth] = useState(localMonth());
  const [data, setData] = useState(null);

  useEffect(() => {
    api('GET', `/api/motivation?month=${month}`).then(setData).catch(() => {});
  }, [month]);

  if (!data) return <div class="empty">Loading motivation stats…</div>;

  const { reward, monthlyExecution, achievements = [] } = data;
  const execPct = Math.round((reward.executionRate || 0) * 100);

  return (
    <div class="motivation-container">
      <div class="top">
        <h1>Motivation & Rewards</h1>
        <input type="month" value={month} onInput={(e) => e.target.value && setMonth(e.target.value)} />
      </div>

      <div class="reward-card">
        <h2>Monthly Reward Status</h2>
        <div class="reward-grid">
          <div class="reward-item">
            <div class="reward-label">Base Reward (≥95%)</div>
            <div class="reward-val">{execPct}%</div>
            <div class="reward-label">{monthlyExecution.completed} / {monthlyExecution.expected} chores</div>
            <div class={`reward-status-pill ${reward.baseRewardAchieved ? 'achieved' : 'pending'}`}>
              {reward.baseRewardAchieved ? 'Achieved ✓' : 'In Progress'}
            </div>
          </div>
          <div class="reward-item">
            <div class="reward-label">Extra Goal</div>
            <div class="reward-val">{reward.extraCurrent} / {reward.extraGoal}</div>
            <div class="reward-label">Challenge Extras</div>
            <div class={`reward-status-pill ${reward.extraRewardAchieved ? 'achieved' : 'pending'}`}>
              {reward.extraRewardAchieved ? 'Achieved ✓' : 'In Progress'}
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2>Achievements ({achievements.filter((a) => a.unlocked).length} / {achievements.length})</h2>
        <div class="achievements-grid">
          {achievements.map((ach) => (
            <div key={ach.id} class={`achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`}>
              <div class="achievement-icon">{ach.icon || '🏆'}</div>
              <div class="achievement-name">{ach.name}</div>
              <div class="achievement-desc">{ach.desc}</div>
              {ach.unlocked ? (
                <div class="achievement-date">Unlocked {ach.unlockedAt}</div>
              ) : (
                <div class="achievement-date" style={{ color: 'var(--muted)' }}>Locked</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
