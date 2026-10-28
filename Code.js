// Provided for free by GCalTools www.gcaltools.com.  Use at your own risk!
// VIDEO: https://youtu.be/8GrGT8SWs-8?si=4ZdRLjQTOx7vApET

// INSTRUCTIONS to Create Birthdays and Special Events from Google Contacts in any Google Calendar


// 1) Make a COPY of this project

// 2) Configure the settings for this script under "CONFIGURATION" below AND CLICK "SAVE PROJECT" ABOVE BEFORE YOU RUN!

// 3) Make sure "updateBirthdays" is selected in the menu above, then click "Run"

// 4) Click 'Advanced' during warnings to proceed, give permissions (to your own account, not mine!)

// 5) DONE! You can run this script again to add new birthdays without creating duplicates

// 6) Optional: Create a "Trigger" to run updateBirthdays daily to add birthdays from new contacts (see VIDEO linked above)


// ******** CONFIGURATION START : CLICK "SAVE PROJECT" ABOVE BEFORE YOU RUN! ********


// REQUIRED:

// CHANGE THIS to 'var useOriginalBirthdayCalendar = true' TO USE GOOGLE's DEFAULT BIRTHDAY CALENDAR
// THIS WILL CREATE DUPLICATES BIRTHDAYS/SPECIAL EVENTS IF YOU HAVE ENABLED SYNCING FROM CONTACTS IN BIRTHDAY SETTINGS

var useOriginalBirthdayCalendar = false;

// CHANGE THIS ID TO THE CALENDAR ID FOR THE CALENDAR YOU WANT TO USE
// THIS WILL BE IGNORED IF useOriginalBirthdayCalendar ABOVE IS true

var calendarId = "xxxxxxxxxxxxxxxxxxxxxxx@group.calendar.google.com";

// ALL SETTINGS BELOW ARE OPTIONAL:

// CHANGE THIS TO THE NAME YOU WANT WHEN THERE IS NO LABEL FOR THE SPECIAL EVENT

var noLabelTitle = "Special Event";

// CHANGE THIS TO 'var onlyBirthdays = true' IF YOU ONLY WANT TO COPY BIRTHDAYS, NOT SPECIAL EVENTS

var onlyBirthdays = false;

// CHANGE THIS TO 'var onlyContactLabel = true' IF YOU ONLY WANT TO COPY BIRTHDAYS FOR CONTACTS WITH A SPECIFIC LABEL
// DON'T FORGET TO SET THE contactLabelID BELOW IF THIS IS true
// USEFUL IF YOU HAVE TOO MANY CONTACTS AND THE SCRIPT WON'T FINISH

var onlyContactLabel = false;

// TO GET THE contactLabelID OPEN https://contacts.google.com/ CLICK YOUR LABEL AND NOTE THE PAGE ADDRESS
// THE LAST PART OF THE ADDRESS IS THE contactLabelID: https://contacts.google.com/label/[contactLabelID]

var contactLabelID = "xxxxxxxxxxxxxx";

// REMINDERS
// Birthdays and special events are all-day events, which start at midnight (00:00)
// Reminders are set in minutes BEFORE midnight, so 0 = midnight on the day, 420 = 5pm the day before
// Set a reminder to null to disable it

// USE CALENDAR'S DEFAULT REMINDERS? (NOT RECOMMENDED, see warning)
// WARNING: GOOGLE REMINDERS BUGS! (tested October 2026, Original Birthday Calendar and Secondary Calendars)
// 1) Google applies the calendar's 'Event notifications', NOT the 'All-day event notifications' you'd expect.
//    e.g. a 30 minute default fires at 11:30pm the night before.
// 2) Google copies that reminder onto each event, so changing your calendar's notification settings later will NOT update them.
// 3) Google does not allow scripts to create a reminder later than midnight on the day, e.g. 'On the same day at 9am' is not possible.
//    The latest reminder possible is 0 (midnight on the day).

var useDefaultReminders = false;

// EMAIL REMINDERS (set to null to disable)

var emailReminder1 = null;       // minutes before midnight (e.g. 0 for midnight on the day, 1440 for midnight the day before)
var emailReminder2 = null;       // second email reminder

// POPUP REMINDERS (set to null to disable)

var popupReminder1 = 60 * 12;    // 12 hours before = 12pm (noon) the day before
var popupReminder2 = null;       // second popup reminder

// Some examples:
// 0 = midnight on the day
// 60 * 3 = 180 = 9pm the day before
// 60 * 7 = 420 = 5pm the day before
// 60 * 12 = 720 = 12pm (noon) the day before
// 60 * 24 = 1440 = midnight the day before
// 60 * 24 * 7 = 10080 = 1 week before

// *** DON'T MODIFY THIS SECTION ***
// This creates the reminders array from your settings above

var reminders = [
  { method: "popup", minutes: popupReminder1 },
  { method: "popup", minutes: popupReminder2 },
  { method: "email", minutes: emailReminder1 },
  { method: "email", minutes: emailReminder2 }
].filter(reminder => reminder.minutes !== null);
// *** END OF REMINDERS CONFIGURATION ***

// ADDITIONAL CONFIGURATION OPTIONS:

// CHANGE THIS TO true TO PREVIEW CHANGES WITHOUT ACTUALLY CREATING/DELETING EVENTS
// Or run the "dryRunUpdate" function to see what would be changed

var dryRun = false;

// CUSTOMIZE EVENT TITLE FORMATS (leave blank to use default format)
// Available variables: {name} - contact's name, {eventType} - the type of event

var birthdayTitleFormat = ""; // Default: "{name}'s Birthday"
var specialEventTitleFormat = ""; // Default: "{name}'s {eventType}"

// ADD CUSTOM DESCRIPTIONS TO EVENTS (Only possible if you are using a secondary calendar)

var addCustomDescriptions = false;
var birthdayDescription = "Birthday celebration for {name}";
var specialEventDescription = "{eventType} for {name}";

// FILTER EVENTS BY DATE RANGE
// USEFUL IF YOU HAVE TOO MANY CONTACTS AND THE SCRIPT WON'T FINISH
// Set specific months or days to include, or leave empty [] for all
// Examples:
// var filterMonths = [1, 2];    // Only January and February
// var filterMonths = [12];      // Only December
// var filterMonths = [];        // All months (default)

var filterMonths = [];          // 1-12 for specific months, empty array for all months

// Examples:
// var filterDays = [1, 15, 31]; // Only 1st, 15th and 31st days of the month
// var filterDays = [25];        // Only 25th day of the month
// var filterDays = [];          // All days (default)

var filterDays = [];            // 1-31 for specific days, empty array for all days

// MORE FLEXIBLE CLEANUP OPTIONS

var deleteSearchPattern = ""; // Custom text to search for when deleting events in secondary calendars (empty for default)
var deleteOnlyFutureEvents = false; // Set to true to keep past events when deleting


// ******** CONFIGURATION END : CLICK "SAVE PROJECT" ABOVE BEFORE YOU RUN! ********

// DO NOT EDIT BELOW THIS LINE UNLESS YOU UNDERSTAND WHAT YOU ARE DOING


/**
 * Displays the current configuration in the Execution Log
 */

function showConfiguration() {
  return GCalTools.showConfiguration();
}

/**
 * Displays what would be changed in the Execution Log without editing the calendar
 * (useful for testing)
 */

function dryRunUpdate() {
  dryRun = true;
  updateBirthdays();
  dryRun = false;
}

/**
 * Displays what would be deleted in the Execution Log without editing the calendar
 * (useful for testing)
 */

function dryRunDelete() {
  dryRun = true;
  deleteEvents();
  dryRun = false;
}


/**
 * Displays what syncBirthdays would create and delete in the Execution Log without editing the calendar
 */

function dryRunSync() {
  dryRun = true;
  syncBirthdays();
  dryRun = false;
}

/**
 * Fully syncs Google's birthday calendar with your contacts (only when useOriginalBirthdayCalendar is true):
 * creates missing events and DELETES script-created birthday events that no longer match a contact
 * (removed contacts, changed names or dates, duplicates). Manually created birthday events are also removed
 * unless they match a contact exactly. Your own birthday and Google's contact-synced events are not touched.
 */
function syncBirthdays() {
  if (!useOriginalBirthdayCalendar) {
    Logger.log("syncBirthdays only works with the original birthday calendar: set useOriginalBirthdayCalendar to true");
    return;
  }
  if (dryRun) {
    Logger.log("DRY RUN MODE: No events will be created or deleted, only logged");
  }
  return GCalTools.syncBirthdayCalendar(dryRun);
}

/**
 * Updates birthdays and special events from Google Contacts to your calendar
 */
function updateBirthdays() {
  if (dryRun) {
    Logger.log("DRY RUN MODE: No events will be created, only logged");
  }
  GCalTools.createSpecialEventsForAllContacts(useOriginalBirthdayCalendar ? "primary" : calendarId);
}

/**
 * Deletes birthday and special events from the calendar based on your configuration
 */
function deleteEvents() {
  const calendarToDeleteId = useOriginalBirthdayCalendar ? 'primary' : calendarId;
  let patterns = [];
  
  if (useOriginalBirthdayCalendar) {
    // For primary calendar, use the standard pattern that matches the birthday flag
    patterns.push(deleteSearchPattern || "Birthday");
  } else {
    // For secondary calendars, we'll gather labels from contacts in the utility function
    if (deleteSearchPattern) {
      patterns.push(deleteSearchPattern);
    } else {
      patterns.push("Birthday"); // Always include Birthday
    }
  }
  
  if (dryRun) {
    Logger.log("DRY RUN MODE: No events will be deleted, only logged");
  }
  
  return GCalTools.deleteEvents(calendarToDeleteId, patterns, deleteOnlyFutureEvents, dryRun);
}