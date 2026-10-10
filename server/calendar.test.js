import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs, fetchIcsFeed } from './calendar.js';

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
