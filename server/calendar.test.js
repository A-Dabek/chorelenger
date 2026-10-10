import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs, fetchIcsFeed, nextOccurrence, resolveUpcoming } from './calendar.js';

test('parseIcs - handles empty and invalid input gracefully', () => {
  assert.deepEqual(parseIcs(''), []);
  assert.deepEqual(parseIcs(null), []);
  assert.deepEqual(parseIcs('INVALID DATA'), []);
});

test('parseIcs - parses standard all-day event with folded description', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20261015',
    'DTEND;VALUE=DATE:20261016',
    'DTSTAMP:20261010T120000Z',
    'UID:test-uid-12345@google.com',
    'SUMMARY:Family Dinner at Bistro',
    'DESCRIPTION:Remember to bring the gift and\\, of course\\,\\n',
    ' a warm jacket for the evening walk.',
    'LOCATION:123 Main St\\, Cityville',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const events = parseIcs(ics);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    external_uid: 'test-uid-12345@google.com',
    title: 'Family Dinner at Bistro',
    notes: 'Remember to bring the gift and, of course,\na warm jacket for the evening walk.',
    location: '123 Main St, Cityville',
    start_date: '2026-10-15',
    start_time: null,
    end_time: null,
    is_all_day: 1,
    rrule: null,
    exdates: '',
  });
});

test('parseIcs - parses timed event with UTC format and multiple events', () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-1@chorelenger
DTSTART:20261018T143000Z
DTEND:20261018T154500Z
SUMMARY:Dentist Checkup
LOCATION:Health Clinic
DESCRIPTION:Annual inspection\\; bring insurance card.
END:VEVENT
BEGIN:VEVENT
UID:event-2@chorelenger
DTSTART;TZID=Europe/Warsaw:20261020T190000
DTEND;TZID=Europe/Warsaw:20261020T210000
SUMMARY:Team Meetup
LOCATION:Office
END:VEVENT
END:VCALENDAR`;

  const events = parseIcs(ics);
  assert.equal(events.length, 2);

  assert.equal(events[0].external_uid, 'event-1@chorelenger');
  assert.equal(events[0].title, 'Dentist Checkup');
  assert.equal(events[0].start_date, '2026-10-18');
  assert.equal(events[0].start_time, '14:30');
  assert.equal(events[0].end_time, '15:45');
  assert.equal(events[0].is_all_day, 0);
  assert.equal(events[0].notes, 'Annual inspection; bring insurance card.');

  assert.equal(events[1].external_uid, 'event-2@chorelenger');
  assert.equal(events[1].title, 'Team Meetup');
  assert.equal(events[1].start_date, '2026-10-20');
  assert.equal(events[1].start_time, '19:00');
  assert.equal(events[1].end_time, '21:00');
  assert.equal(events[1].is_all_day, 0);
});

test('fetchIcsFeed - converts webcal:// to https:// and fetches feed content', async () => {
  let calledUrl = null;
  const mockFetch = async (url) => {
    calledUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => 'BEGIN:VCALENDAR\nEND:VCALENDAR',
    };
  };

  const content = await fetchIcsFeed('webcal://calendar.google.com/feed/basic.ics', { fetchFn: mockFetch });
  assert.equal(calledUrl, 'https://calendar.google.com/feed/basic.ics');
  assert.ok(content.includes('BEGIN:VCALENDAR'));
});

test('fetchIcsFeed - throws error when response is not ok', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 404,
    statusText: 'Not Found',
  });

  await assert.rejects(
    () => fetchIcsFeed('https://example.com/calendar.ics', { fetchFn: mockFetch }),
    /Feed URL returned 404 Not Found/
  );
});

test('parseIcs - reads RRULE and EXDATE, ignores RECURRENCE-ID overrides', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:series@x',
    'SUMMARY:Standup',
    'DTSTART;VALUE=DATE:20200101',
    'RRULE:FREQ=WEEKLY;BYDAY=MO',
    'EXDATE;VALUE=DATE:20261012,20261019',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:series@x',
    'SUMMARY:Standup moved',
    'RECURRENCE-ID;VALUE=DATE:20261026',
    'DTSTART;VALUE=DATE:20261027',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const events = parseIcs(ics);
  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'Standup');
  assert.equal(events[0].rrule, 'FREQ=WEEKLY;BYDAY=MO');
  assert.equal(events[0].exdates, '2026-10-12,2026-10-19');
});

test('nextOccurrence - non-recurring', () => {
  assert.equal(nextOccurrence({ start_date: '2026-10-09' }, '2026-10-10'), null);
  assert.equal(nextOccurrence({ start_date: '2026-10-10' }, '2026-10-10'), '2026-10-10');
});

test('nextOccurrence - daily, weekly, monthly, yearly', () => {
  assert.equal(nextOccurrence({ start_date: '2026-10-01', rrule: 'FREQ=DAILY;INTERVAL=3' }, '2026-10-10'), '2026-10-10');
  assert.equal(nextOccurrence({ start_date: '2026-10-01', rrule: 'FREQ=DAILY;INTERVAL=3' }, '2026-10-11'), '2026-10-13');
  // 2026-10-10 is a Saturday; next Monday is 10-12
  assert.equal(nextOccurrence({ start_date: '2020-01-06', rrule: 'FREQ=WEEKLY;BYDAY=MO,WE' }, '2026-10-10'), '2026-10-12');
  assert.equal(nextOccurrence({ start_date: '2020-01-06', rrule: 'FREQ=WEEKLY' }, '2026-10-10'), '2026-10-12');
  assert.equal(nextOccurrence({ start_date: '2020-01-31', rrule: 'FREQ=MONTHLY' }, '2026-10-10'), '2026-10-31');
  assert.equal(nextOccurrence({ start_date: '2020-03-15', rrule: 'FREQ=YEARLY' }, '2026-10-10'), '2027-03-15');
});

test('nextOccurrence - COUNT, UNTIL, EXDATE, unsupported', () => {
  assert.equal(nextOccurrence({ start_date: '2026-10-01', rrule: 'FREQ=DAILY;COUNT=5' }, '2026-10-10'), null);
  assert.equal(nextOccurrence({ start_date: '2026-10-08', rrule: 'FREQ=DAILY;COUNT=5' }, '2026-10-10'), '2026-10-10');
  assert.equal(nextOccurrence({ start_date: '2026-10-01', rrule: 'FREQ=DAILY;UNTIL=20261009T000000Z' }, '2026-10-10'), null);
  assert.equal(nextOccurrence({ start_date: '2026-10-01', rrule: 'FREQ=DAILY', exdates: '2026-10-10,2026-10-11' }, '2026-10-10'), '2026-10-12');
  assert.equal(nextOccurrence({ start_date: '2026-10-01', rrule: 'FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO' }, '2026-10-10'), null);
});

test('resolveUpcoming - drops past, advances recurring', () => {
  const evs = [
    { title: 'old', start_date: '2026-01-01', rrule: null, exdates: '' },
    { title: 'today', start_date: '2026-10-10', rrule: null, exdates: '' },
    { title: 'series', start_date: '2020-10-11', rrule: 'FREQ=YEARLY', exdates: '' },
    { title: 'ended', start_date: '2020-10-11', rrule: 'FREQ=YEARLY;COUNT=2', exdates: '' },
  ];
  const r = resolveUpcoming(evs, '2026-10-10');
  assert.deepEqual(r.map((e) => [e.title, e.start_date]), [['today', '2026-10-10'], ['series', '2026-10-11']]);
});
