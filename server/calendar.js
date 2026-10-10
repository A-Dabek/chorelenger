function unescapeIcsText(str = '') {
  return str
    .replace(/\\\\/g, '\\')
    .replace(/\\;/g, ';')
    .replace(/\\,/g, ',')
    .replace(/\\[nN]/g, '\n');
}

function parseDateTimeValue(val = '') {
  let clean = val.trim();
  if (clean.toUpperCase().startsWith('VALUE=DATE:')) {
    clean = clean.slice(11).trim();
  } else if (clean.toUpperCase().startsWith('VALUE=DATE-TIME:')) {
    clean = clean.slice(16).trim();
  }

  // Format 1: YYYYMMDD (8 digits) -> All-Day date
  const dateMatch = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateMatch) {
    const [, y, m, d] = dateMatch;
    return {
      date: `${y}-${m}-${d}`,
      time: null,
      isAllDay: true,
    };
  }

  // Format 2: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMM
  const timeMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (timeMatch) {
    const [, y, m, d, hh, mm] = timeMatch;
    return {
      date: `${y}-${m}-${d}`,
      time: `${hh}:${mm}`,
      isAllDay: false,
    };
  }

  return null;
}

export function parseIcs(icsString = '') {
  if (typeof icsString !== 'string' || !icsString.trim()) {
    return [];
  }

  // Unfold lines: RFC 5545 specifies that lines starting with space or tab are continuations
  const unfolded = icsString.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events = [];
  let inEvent = false;
  let currentEvent = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        external_uid: null,
        title: '',
        notes: '',
        location: '',
        start_date: '',
        start_time: null,
        end_time: null,
        is_all_day: 1,
      };
      continue;
    }

    if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.title && currentEvent.start_date) {
        events.push(currentEvent);
      }
      inEvent = false;
      currentEvent = null;
      continue;
    }

    if (!inEvent || !currentEvent) continue;

    // Split property name (with possible params) and value
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const propHeader = line.slice(0, colonIndex).toUpperCase();
    const propVal = line.slice(colonIndex + 1);

    if (propHeader === 'UID' || propHeader.startsWith('UID;')) {
      currentEvent.external_uid = propVal.trim();
    } else if (propHeader === 'SUMMARY' || propHeader.startsWith('SUMMARY;')) {
      currentEvent.title = unescapeIcsText(propVal).trim() || '(No title)';
    } else if (propHeader === 'DESCRIPTION' || propHeader.startsWith('DESCRIPTION;')) {
      currentEvent.notes = unescapeIcsText(propVal).trim();
    } else if (propHeader === 'LOCATION' || propHeader.startsWith('LOCATION;')) {
      currentEvent.location = unescapeIcsText(propVal).trim();
    } else if (propHeader === 'DTSTART' || propHeader.startsWith('DTSTART;') || propHeader.startsWith('DTSTART:')) {
      const parsed = parseDateTimeValue(propVal.trim());
      if (parsed) {
        currentEvent.start_date = parsed.date;
        currentEvent.start_time = parsed.time;
        currentEvent.is_all_day = parsed.isAllDay ? 1 : 0;
      }
    } else if (propHeader === 'DTEND' || propHeader.startsWith('DTEND;') || propHeader.startsWith('DTEND:')) {
      const parsed = parseDateTimeValue(propVal.trim());
      if (parsed && !parsed.isAllDay) {
        currentEvent.end_time = parsed.time;
      }
    }
  }

  return events;
}

export async function fetchIcsFeed(feedUrl, { timeoutMs = 10000, fetchFn = globalThis.fetch } = {}) {
  if (!feedUrl || typeof feedUrl !== 'string') {
    throw new Error('Invalid feed URL');
  }

  // Convert webcal:// to https:// and clean up URL
  let normalizedUrl = feedUrl.trim().replace(/^["']|["']$/g, '');
  if (normalizedUrl.startsWith('webcal://')) {
    normalizedUrl = 'https://' + normalizedUrl.slice(9);
  } else if (normalizedUrl.startsWith('webcals://')) {
    normalizedUrl = 'https://' + normalizedUrl.slice(10);
  } else if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(normalizedUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Chorelenger-Calendar-Sync/1.0)',
        'Accept': 'text/calendar, text/plain, application/octet-stream, */*',
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Feed URL returned 404 Not Found. Make sure you copied the "Secret address in iCal format" from Google Calendar settings (ends in .ics), not the browser URL.');
      }
      throw new Error(`Feed request failed with status ${res.status}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
