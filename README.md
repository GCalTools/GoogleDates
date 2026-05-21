# GoogleDates

A free Google Apps Script that copies Birthdays (and optionally Special Events) from Google Contacts into any Google Calendar you own.

Provided by [GCalTools](https://www.gcaltools.com). Use at your own risk.

Video walkthrough: https://youtu.be/8GrGT8SWs-8

## What it does

- Reads contacts from your Google account via the People API
- Creates yearly recurring all-day events on the calendar of your choice
- Supports Google's built-in Birthday calendar or any secondary calendar you own
- Avoids duplicates when re-run, so it's safe to schedule as a daily trigger
- Includes dry-run modes so you can preview changes before they happen

## Installation

You can either copy the published project (easiest) or set up a new Apps Script project manually from this repo.

### Option A: Copy the published project (recommended)

Follow the steps in the [video](https://youtu.be/8GrGT8SWs-8) to make a copy of the shared script into your own Google account. Once copied:

1. Open the project in the [Apps Script editor](https://script.google.com/).
2. Skip to [Configuration](#configuration) below.

### Option B: Set up manually from this repo

1. Go to https://script.google.com/ and click **New project**.
2. Replace the contents of the default `Code.gs` with [Code.js](Code.js) from this repo.
3. Create a new script file called `Utilities` and paste in [Utilities.js](Utilities.js).
4. Open the project settings (gear icon) and check **Show "appsscript.json" manifest file in editor**.
5. Replace the contents of `appsscript.json` with [appsscript.json](appsscript.json) from this repo. This enables the required Calendar v3 and People v1 advanced services and declares the OAuth scopes.
6. Click **Save project**.

## Configuration

All settings live at the top of [Code.js](Code.js), between the `CONFIGURATION START` and `CONFIGURATION END` markers. **Save the project after every change** before running.

### Required

- `useOriginalBirthdayCalendar` — set to `true` to write into Google's built-in Birthday calendar. Leave `false` to use a secondary calendar.
  - Warning: if you set this to `true` AND you already have "Show birthdays from contacts" enabled in your Birthday calendar settings, you will get duplicates.
- `calendarId` — the ID of the secondary calendar you want to write to. Ignored if `useOriginalBirthdayCalendar` is `true`.
  - Find this in Google Calendar under **Settings > [your calendar] > Integrate calendar > Calendar ID**. It looks like `xxxxxxxx@group.calendar.google.com`.

### Optional

- `onlyBirthdays` — `true` copies only birthdays; `false` (default) also copies Special Events like anniversaries.
- `noLabelTitle` — title to use when a Special Event has no label (default: `"Special Event"`).
- `onlyContactLabel` + `contactLabelID` — limit syncing to contacts with a specific label. Useful for very large contact lists that would otherwise time out. Find the label ID at the end of the URL when you open the label at https://contacts.google.com/.
- `filterMonths` / `filterDays` — restrict syncing to certain months (1–12) or days (1–31). Also useful for splitting up large runs.
- `birthdayTitleFormat` / `specialEventTitleFormat` — customize event titles. Supports `{name}` and `{eventType}` placeholders.
- `addCustomDescriptions`, `birthdayDescription`, `specialEventDescription` — add descriptions to events. Only works on secondary calendars (Google's primary Birthday calendar does not support descriptions).
- `deleteSearchPattern`, `deleteOnlyFutureEvents` — control which events `deleteEvents()` removes.

### Reminders

- `useDefaultReminders` — `true` (recommended) uses the target calendar's default reminders, so you can change them later in Calendar settings without re-running the script.
- `popupReminder1`, `popupReminder2`, `emailReminder1`, `emailReminder2` — only used when `useDefaultReminders` is `false`. Values are in minutes (e.g. `1440` = 1 day, `10080` = 1 week). Set to `0` to disable.

Note on reminders: when writing to the original Birthday calendar with default reminders, Google applies your main calendar's regular event notifications, not the all-day or Birthday-specific ones. Using a secondary calendar avoids this quirk.

## Usage

In the Apps Script editor, pick a function from the dropdown next to the **Run** button:

- `showConfiguration()` — prints your current settings to the execution log. Run this first to confirm things look right.
- `dryRunUpdate()` — logs what events *would* be created, without touching your calendar.
- `updateBirthdays()` — the real run. Creates events from your contacts.
- `dryRunDelete()` — logs what events *would* be deleted.
- `deleteEvents()` — removes birthday/special events from the configured calendar.

The first time you run any function, Google will ask you to authorize the script. Click **Advanced > Go to (unsafe)** to grant permissions to **your own** copy of the script. The script requests read-only access to Contacts and read/write access to Calendar.

`updateBirthdays()` is safe to re-run; it will not create duplicates.

## Automating with a daily trigger (optional)

To pick up new contacts automatically:

1. In the Apps Script editor, open **Triggers** (the clock icon on the left).
2. Click **Add Trigger**.
3. Choose function `updateBirthdays`, event source **Time-driven**, type **Day timer**, and a time of day.
4. Save.

The video linked above walks through this step.

## Files

- [Code.js](Code.js) — configuration and the functions that appear in the Run menu.
- [Utilities.js](Utilities.js) — implementation under the `GCalTools` namespace.
- [appsscript.json](appsscript.json) — Apps Script manifest (advanced services and OAuth scopes).
