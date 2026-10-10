import { ChallengeBanner } from '../components/ChallengeBanner.jsx';
import { ChoreCard } from '../components/ChoreCard.jsx';

export function Today({ chores, challengeData, onDone, onExtra }) {
  const spotlightIds = challengeData?.spotlightChoreIds || [];
  const show = (s) => chores.filter((c) => c.status === s && !c.doneToday);
  const doneToday = chores.filter((c) => c.doneToday);
  const sections = [['Overdue', show('overdue')], ['Due', show('due')], ['Upcoming', show('upcoming').slice(0, 5)], ['Done today', doneToday]];
  const empty = sections.every(([, l]) => !l.length);
  return (
    <>
      <ChallengeBanner challengeData={challengeData} onExtra={onExtra} />
      <h1>Today</h1>
      {empty && <div class="empty">No chores yet — add some in the Chores tab.</div>}
      {sections.map(([title, list]) => list.length > 0 && (
        <section key={title}>
          <h2>{title}</h2>
          {list.map((c) => (
            <ChoreCard
              key={c.id}
              c={c}
              isSpotlighted={spotlightIds.includes(c.id)}
              onDone={title === 'Done today' ? undefined : onDone}
            />
          ))}
        </section>
      ))}
    </>
  );
}
