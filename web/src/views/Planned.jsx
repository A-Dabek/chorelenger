import { useState, useEffect, useCallback } from 'preact/hooks';
import { api } from '../api.js';
import { localToday, addDays } from '../lib/dates.js';
import { getGoogleCalendarUrl } from '../lib/calendar.js';

function sortPlannedItems(list) {
  return [...list].sort((a, b) => (
    a.start_date.localeCompare(b.start_date) ||
    (a.start_time || '').localeCompare(b.start_time || '') ||
    a.title.localeCompare(b.title)
  ));
}

function PlannedItemCard({ item, onConfirm, onEdit }) {
  const isCalendar = item.source !== 'manual';
  const isCompleted = item.status === 'completed';
  const isOverdue = !isCompleted && item.start_date < localToday();

  return (
    <div class={`planned-card ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
      <div class="info" onClick={onEdit ? () => onEdit(item) : undefined}>
        <div class="name">
          <span class={`source-badge ${isCalendar ? 'calendar' : 'manual'}`}>
            {isCalendar ? '📅 Calendar Event' : '📝 One-Off Task'}
          </span>
          {item.title}
          {item.recurring && <span title="Repeats" aria-label="Repeats"> 🔁</span>}
        </div>
        <div class="meta">
          <b>{item.start_date}</b>
          {item.start_time && ` · ${item.start_time}${item.end_time ? ` - ${item.end_time}` : ''}`}
          {item.location && ` · 📍 ${item.location}`}
          {item.notes && ` · ${item.notes}`}
          {isOverdue && ' · Overdue'}
          {isCompleted && ` · ${isCalendar ? 'acknowledged ✓' : 'done ✓'}`}
        </div>
      </div>
      <div class="planned-actions">
        {!isCompleted && !isCalendar && (
          <a
            class="gcal-link"
            href={getGoogleCalendarUrl(item)}
            target="_blank"
            rel="noopener noreferrer"
            title="Add to Google Calendar"
          >
            📅 Google Cal
          </a>
        )}
        {!isCompleted && !isCalendar && onConfirm && (
          <button class="done-btn" onClick={() => onConfirm(item)}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}

function PlannedItemForm({ item, onSave, onCancel, onDelete }) {
  const [f, setF] = useState(item || {
    title: '',
    start_date: localToday(),
    start_time: '',
    end_time: '',
    notes: '',
    location: '',
  });
  const [err, setErr] = useState('');

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: f.title,
        start_date: f.start_date || localToday(),
        start_time: f.start_time || null,
        end_time: f.end_time || null,
        notes: f.notes || '',
        location: f.location || '',
      };
      if (item?.id) {
        await api('PUT', `/api/planned/${item.id}`, payload);
      } else {
        await api('POST', '/api/planned', payload);
      }
      onSave();
    } catch (x) {
      setErr(x.message);
    }
  };

  return (
    <form onSubmit={submit}>
      <h2>{item?.id ? 'Edit Planned Item' : 'New One-Off Task'}</h2>
      <label>Title<input value={f.title || ''} onInput={set('title')} required autoFocus /></label>
      <label>Date<input type="date" value={f.start_date || ''} onInput={set('start_date')} required /></label>
      <div class="row">
        <label>Start time<input type="time" value={f.start_time || ''} onInput={set('start_time')} /></label>
        <label>End time<input type="time" value={f.end_time || ''} onInput={set('end_time')} /></label>
      </div>
      <label>Location<input value={f.location || ''} onInput={set('location')} placeholder="e.g. Office, City Post" /></label>
      <label>Notes<input value={f.notes || ''} onInput={set('notes')} placeholder="Details, checklist..." /></label>
      {err && <div class="error">{err}</div>}
      <div class="row">
        <button>Save</button>
        <button type="button" class="ghost" onClick={onCancel}>Cancel</button>
      </div>
      {item?.id && (
        <button
          type="button"
          class="danger"
          onClick={() => confirm(`Delete "${item.title}"?`) && onDelete(item)}
        >
          Delete
        </button>
      )}
    </form>
  );
}

export function PlannedView({ onConfirm, toast }) {
  const [items, setItems] = useState([]);
  const [feedUrl, setFeedUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, settings] = await Promise.all([
        api('GET', '/api/planned'),
        api('GET', '/api/settings/calendar'),
      ]);
      setItems(list);
      setFeedUrl(settings.feedUrl || '');
    } catch (_) {}
  }, []);

  useEffect(() => {
    load();
  }, [load, toast]);

  const handleConfirm = async (it) => {
    if (onConfirm) await onConfirm(it);
    load();
  };

  const saveFeedUrl = async (e) => {
    e.preventDefault();
    try {
      await api('PUT', '/api/settings/calendar', { feedUrl });
      setSyncStatus('Feed URL saved.');
      setShowSettings(false);
      load();
    } catch (err) {
      setSyncStatus(`Error saving: ${err.message}`);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    setSyncStatus('Syncing calendar feed…');
    try {
      const res = await api('POST', '/api/planned/sync', {});
      if (res.synced) {
        setSyncStatus(`Synced ${res.count} calendar events.`);
      } else {
        setSyncStatus(res.message || 'Sync not configured.');
      }
      load();
    } catch (err) {
      setSyncStatus(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const importIcsText = async (text) => {
    try {
      const res = await api('POST', '/api/planned/import-ics', { ics: text });
      setSyncStatus(`Imported ${res.importedCount} events from .ics file.`);
      load();
    } catch (err) {
      setSyncStatus(`Import failed: ${err.message}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => importIcsText(ev.target.result);
      reader.readAsText(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => importIcsText(ev.target.result);
      reader.readAsText(file);
    }
  };

  if (editing) {
    return (
      <PlannedItemForm
        item={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={() => {
          setEditing(null);
          load();
        }}
        onDelete={async (it) => {
          await api('DELETE', `/api/planned/${it.id}`);
          setEditing(null);
          load();
        }}
      />
    );
  }

  const todayStr = localToday();
  const in7DaysStr = addDays(todayStr, 7);

  const pendingItems = items.filter((it) => it.status === 'pending');
  const completedItems = items.filter((it) => it.status === 'completed');

  const overdueItems = sortPlannedItems(pendingItems.filter((it) => it.start_date < todayStr));
  const todayItems = sortPlannedItems(pendingItems.filter((it) => it.start_date === todayStr));
  const upcomingItems = sortPlannedItems(pendingItems.filter((it) => it.start_date > todayStr && it.start_date <= in7DaysStr));
  const laterItems = sortPlannedItems(pendingItems.filter((it) => it.start_date > in7DaysStr));
  const completedSorted = sortPlannedItems(completedItems);

  const sections = [
    ['Overdue', overdueItems],
    ['Today', todayItems],
    ['Upcoming (Next 7 Days)', upcomingItems],
    ['Later', laterItems],
    ['Completed & Acknowledged', completedSorted],
  ];

  return (
    <div class="planned-container">
      <div class="top">
        <h1>Planned Items & Calendar</h1>
        <button onClick={() => setEditing('new')}>+ Plan Item</button>
      </div>

      <div class="sync-bar">
        <div class="sync-info">
          <span>{feedUrl ? '🔗 Calendar feed linked' : 'No calendar feed linked'}</span>
          {syncStatus && <span>· {syncStatus}</span>}
        </div>
        <div class="sync-buttons">
          {feedUrl && (
            <button class="ghost" onClick={triggerSync} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync Feed'}
            </button>
          )}
          <button class="ghost" onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? 'Close Settings' : 'Feed Settings'}
          </button>
        </div>
      </div>

      {showSettings && (
        <form class="settings-panel" onSubmit={saveFeedUrl}>
          <h2>iCal Feed Sync (Google Calendar / Apple)</h2>
          <label>
            Private iCal Feed URL (webcal:// or https://...basic.ics)
            <input
              type="text"
              value={feedUrl}
              onInput={(e) => setFeedUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            />
          </label>
          <div class="row">
            <button>Save Feed URL</button>
            <button type="button" class="ghost" onClick={() => setShowSettings(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div
        class={`dropzone ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('ics-file-input')?.click()}
      >
        <span>Drop your <code>.ics</code> calendar file here, or click to upload</span>
        <input
          id="ics-file-input"
          type="file"
          accept=".ics,text/calendar"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>

      {items.length === 0 && (
        <div class="empty">No planned items or calendar events yet.</div>
      )}

      {sections.map(([title, list]) => list.length > 0 && (
        <section key={title}>
          <h2>{title} ({list.length})</h2>
          {list.map((it) => (
            <PlannedItemCard
              key={it.id}
              item={it}
              onConfirm={handleConfirm}
              onEdit={it.source === 'manual' ? setEditing : undefined}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
