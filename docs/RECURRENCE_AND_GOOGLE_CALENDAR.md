# Recurrence Enhancement & Google Calendar Sync

This document describes the enhanced recurrence features and Google Calendar bidirectional sync functionality added to Orkest.

## Table of Contents

1. [Enhanced Recurrence Rules](#enhanced-recurrence-rules)
2. [Google Calendar Sync](#google-calendar-sync)
3. [Database Migration](#database-migration)
4. [Environment Variables](#environment-variables)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)

---

## Enhanced Recurrence Rules

### New Features

#### Nth Weekday of Month (BYSETPOS)

Schedule tasks for patterns like "2nd Tuesday of every month" or "last Friday of every month".

**How to use:**
1. Create or edit a task
2. Set recurrence to "Monthly"
3. Under "Monthly pattern", select "The nth weekday"
4. Choose the position (1st, 2nd, 3rd, 4th, 5th, or Last)
5. Choose the day of the week

**Examples:**
- 2nd Tuesday of every month → `BYDAY=TU;BYSETPOS=2`
- Last Friday of every month → `BYDAY=FR;BYSETPOS=-1`
- 1st Monday of every 3 months → `BYDAY=MO;BYSETPOS=1;INTERVAL=3`

#### Count End Condition (Repeat N Times)

Set a recurrence to stop after a specific number of occurrences.

**How to use:**
1. Create or edit a task with recurrence enabled
2. Under "Ends", select "After"
3. Enter the number of occurrences

**Examples:**
- Daily for 10 times → `FREQ=DAILY;COUNT=10`
- Weekly on Mon/Wed for 5 occurrences → `FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5`

#### Occurrence Preview

When setting up recurrence rules, a preview of the next 10 occurrence dates is displayed below the recurrence options. This helps verify the rule is configured correctly before saving.

#### EXDATE in ICS Export

Exception dates (excluded occurrences) are now properly exported in ICS files using the `EXDATE` property, ensuring compatibility with other calendar applications.

### Technical Details

**Storage:** Recurrence rules are stored in two ways:
1. **Structured columns** (`recurrence_type`, `recurrence_interval`, `days_of_week`, `recurrence_end_type`, `recurrence_end_date`, `recurrence_count`, `recurrence_bysetpos`) for UI round-tripping
2. **Raw RRULE string** (`rrule` column) for actual occurrence expansion using the `rrule` npm package

**New database columns:**
- `recurrence_count` (integer, nullable) — number of occurrences for COUNT end condition
- `recurrence_bysetpos` (integer, nullable) — position for nth weekday pattern (1-5 or -1 for last)

---

## Google Calendar Sync

### Overview

Orkest supports bidirectional sync with Google Calendar. Tasks created in Orkest appear in your Google Calendar, and events from Google Calendar are imported into Orkest.

### Setup

#### 1. Google Cloud Console Setup

Before using the sync feature, you need to set up Google OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Calendar API" and enable it
4. Also enable the **Google People API** (for user info):
   - Search for "Google People API" and enable it
5. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: `https://your-domain.com/api/google-calendar/callback`
   - Save the **Client ID** and **Client Secret**

#### 2. Environment Variables

Add these to your `.env.local` file:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/google-calendar/callback
```

#### 3. Database Migration

Run the Google Calendar sync migration:

```sql
-- Run: supabase/migrations/google_calendar_sync.sql
```

This creates:
- `google_calendar_connections` table for storing OAuth tokens and sync state
- `google_event_id`, `google_calendar_id`, `last_google_sync_at` columns on the `items` table

#### 4. Connect Your Calendar

1. Go to **Settings** in Orkest
2. Find the **Google Calendar** section
3. Click **Connect**
4. Authorize Orkest in the Google consent screen
5. You'll be redirected back to Orkest with the connection established

### Usage

#### Manual Sync

Click the **Sync** button in Settings → Google Calendar to trigger a manual sync.

#### What Gets Synced

| Orkest → Google | Google → Orkest |
|-----------------|-----------------|
| Task title | Event summary |
| Description | Description |
| Start/end dates & times | Start/end dates & times |
| All-day events | All-day events |
| Recurrence rules | Recurrence rules |
| Exception dates (exdates) | Exception dates |
| Task status (completed → transparent) | Event status |

#### Conflict Resolution

When the same item is modified in both Orkest and Google Calendar between syncs:
- **Last write wins**: The most recently modified version takes precedence
- Google's `updated` timestamp is compared with the local `updated_at` field

#### Recurrence Handling

- RRULE strings are converted between Orkest and Google Calendar formats
- BYSETPOS (nth weekday) is preserved
- COUNT end conditions are preserved
- EXDATE (exception dates) are synced bidirectionally

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/google-calendar/auth` | GET | Returns Google OAuth consent URL |
| `/api/google-calendar/callback` | GET | OAuth callback handler |
| `/api/google-calendar/connection` | GET | Returns connection status |
| `/api/google-calendar/connection` | DELETE | Disconnects Google Calendar |
| `/api/google-calendar/sync` | POST | Triggers a sync |

### Architecture

```
lib/google/
├── calendar-service.ts   # OAuth2, token management, Calendar API calls
├── rrule-converter.ts    # RRULE ↔ Google recurrence format conversion
├── event-converter.ts    # ManualItemRecord ↔ Google Event mapping
└── sync-engine.ts        # Incremental bidirectional sync engine
```

**Sync Flow:**
1. **Push local changes**: Items modified since last sync are pushed to Google
   - New items → `createGoogleEvent()`
   - Existing items → `updateGoogleEvent()`
2. **Pull Google changes**: Uses sync tokens for incremental fetch
   - New events → create local item
   - Updated events → update local item (with conflict detection)
   - Deleted events → mark local item as cancelled
3. **Update sync state**: Store last sync token and timestamp

---

## Database Migration

### Recurrence Enhancement (`recurrence_enhancement.sql`)

Adds `'after_count'` to the `recurrence_end_type` column (handles both ENUM and CHECK constraint cases) and adds `recurrence_count` and `recurrence_bysetpos` columns to the `items` table.

### Google Calendar Sync (`google_calendar_sync.sql`)

Creates `google_calendar_connections` table and adds sync columns to `items`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | For Google Sync | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | For Google Sync | Google OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | For Google Sync | OAuth callback URL |

---

## Troubleshooting

### Google Calendar sync fails with "No active connection"

- Ensure you've connected your Google Calendar in Settings
- Check that the OAuth tokens haven't expired (they auto-refresh, but manual reconnection may be needed)

### Recurrence preview shows wrong dates

- Verify the start date is set correctly
- For nth weekday patterns, ensure exactly one day of the week is selected
- Check that the timezone is set correctly on the task

### EXDATE not appearing in exported ICS

- Ensure the task has exception dates set (from completing/skipping individual occurrences)
- The ICS export includes EXDATE only when `exdates` array is non-empty

### Type errors after migration

Run the database migration, then restart your development server:
```bash
npx supabase db push
npm run dev
```
