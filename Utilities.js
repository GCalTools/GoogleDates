/**
 * Utility functions for Google Dates
 * This file contains all the helper functions that don't need to appear in the Run menu
 */

var GCalTools = {};

// Main function to process contacts and create events
GCalTools.createSpecialEventsForAllContacts = function(calendarId) {
  const peopleService = People.People;
  const calendarService = CalendarApp;
  let stats = { processed: 0, created: 0, skipped: 0, errors: 0 };
  
  let pageToken = null;
  const pageSize = 100;
  let calendarNotFound = false;  // Add a flag to track calendar not found state

  try {
    // Verify calendar exists before starting to process contacts
    try {
      calendarService.getCalendarById(calendarId);
    } catch (error) {
      Logger.log(`Error: Calendar not found or invalid ID: ${calendarId}`);
      return stats;
    }
    
    do {
      var response;
      response = peopleService.Connections.list('people/me', {
        pageSize: pageSize,
        personFields: 'names,birthdays,events,memberships',
        pageToken: pageToken
      });

      const connections = response.connections || [];

      connections.forEach(connection => {
        if (calendarNotFound) return;  // Skip processing if calendar not found
        const names = connection.names || [];
        const memberships = connection.memberships || [];
        let hasLabel = false;
        memberships.forEach(membership => {
          if (membership.contactGroupMembership != null && membership.contactGroupMembership.contactGroupId.includes(contactLabelID)) {
            hasLabel = true;
          }
        });

        const contactName = names.length > 0 ? names[0].displayName : 'Unnamed Contact';

          if (!onlyContactLabel || hasLabel) {
              // Process Birthdays
              const birthdays = connection.birthdays || [];
              birthdays.forEach(birthday => {
                  if (calendarNotFound) return;  // Skip processing if calendar not found
                  if (GCalTools.shouldProcessDate(birthday.date)) {
                      let title = GCalTools.formatEventTitle(birthdayTitleFormat || `{name}'s Birthday`, contactName, "Birthday");
                      let description = addCustomDescriptions ? GCalTools.formatEventTitle(birthdayDescription, contactName, "Birthday") : "";
                      let result = GCalTools.createOrUpdateEvent(calendarService, calendarId, contactName, birthday.date, title, description);
                      if (result === 'notfound') {
                          calendarNotFound = true;  // Set flag to stop processing
                          return;
                      }

                      GCalTools.updateStats(stats, result);
                  }
              });
          }
        
        // Process Special Events (e.g., anniversaries, custom events with labels)
        if (!calendarNotFound && !onlyBirthdays) {  // Only process if calendar is found
          const events = connection.events || [];
          events.forEach(event => {
            if (calendarNotFound) return;  // Skip processing if calendar not found
            if (GCalTools.shouldProcessDate(event.date)) {
              const eventLabel = event.formattedType || noLabelTitle;
              let title = GCalTools.formatEventTitle(specialEventTitleFormat || `{name}'s {eventType}`, contactName, eventLabel);
              let description = addCustomDescriptions ? GCalTools.formatEventTitle(specialEventDescription, contactName, eventLabel) : "";
              let result = GCalTools.createOrUpdateEvent(calendarService, calendarId, contactName, event.date, title, description);
              if (result === 'notfound') {
                  calendarNotFound = true;  // Set flag to stop processing
                  return;
              }
              GCalTools.updateStats(stats, result);
            }
          });
        }
      });

      pageToken = response.nextPageToken;
    } while (pageToken && !calendarNotFound);  // Stop paging if calendar not found
    
    // Log summary statistics
    Logger.log(`Summary: Processed ${stats.processed} contacts, created ${stats.created} events, skipped ${stats.skipped} existing events, encountered ${stats.errors} errors`);
    
  } catch (error) {
    Logger.log("Check the CONFIGURATION section is correct: " + error.message);
  }
  
  return stats;
};

// Helper for date filtering
GCalTools.shouldProcessDate = function(date) {
  if (!date) return false;
  
  // If arrays are empty, include all months/days
  const includeAllMonths = filterMonths.length === 0;
  const includeAllDays = filterDays.length === 0;
  
  // Check if the date's month is in the filterMonths array
  const monthMatches = includeAllMonths || filterMonths.includes(date.month);
  
  // Check if the date's day is in the filterDays array
  const dayMatches = includeAllDays || filterDays.includes(date.day);
  
  // Both month and day must match the filter criteria
  return monthMatches && dayMatches;
};

// Format titles with variables
GCalTools.formatEventTitle = function(format, name, eventType) {
  return format.replace('{name}', name).replace('{eventType}', eventType);
};

// Update statistics
GCalTools.updateStats = function(stats, result) {
  stats.processed++;
  if (result === 'created') stats.created++;
  else if (result === 'skipped') stats.skipped++;
  else if (result === 'error') stats.errors++;
};

// Create or update a calendar event
GCalTools.createOrUpdateEvent = function(calendarService, calendarId, contactName, eventDate, eventTitle, eventDescription = "") {
  if (eventDate) {

    // Handle cases where the event year might be undefined
    const year = eventDate.year || new Date().getFullYear(); // Use current year if not specified
    const startDate = new Date(year, eventDate.month - 1, eventDate.day);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    // Check for existing events specifically for this contact on the event date
    let existingEvents = [];
    try {
        existingEvents = calendarService.getCalendarById(calendarId).getEvents(startDate, endDate);    
    } catch (error) {
        Logger.log(`Error: Calendar not found or invalid ID: ${calendarId}`);
        return 'notfound';
    }

    const eventExists = existingEvents.some(event => event.getTitle() === eventTitle);
    var event;
    // Create the event if it doesn't already exist
    if (!eventExists) {
      if (dryRun) {
        Logger.log(`DRY RUN: Would create ${eventTitle} for ${contactName} on ${startDate.toDateString()}`);
        return 'created';
      }
      
      if (!useOriginalBirthdayCalendar) {
        try {
          // Use CalendarApp to create a regular event in a regular calendar
          event = calendarService.getCalendarById(calendarId).createAllDayEventSeries(
            eventTitle,
            startDate,
            CalendarApp.newRecurrence().addYearlyRule(),
            { description: eventDescription }
          );
          
          // Apply all configured reminders
          if (!useDefaultReminders && reminders.length > 0) {
            reminders.forEach(reminder => {
              if (reminder.method === "email") {
                event.addEmailReminder(reminder.minutes);
              } else if (reminder.method === "popup") {
                event.addPopupReminder(reminder.minutes);
              }
            });
          }
        } catch (error) {
          Logger.log(`Error creating event for ${contactName}: ${error.message}`);
          return 'error';
        }
      } else {
        try {
          event = GCalTools.insertBirthdayEvent(calendarId, startDate, endDate, eventTitle);
        } catch (error) {
          Logger.log(`Error creating event for ${contactName}: ${error.message}`);
          return 'error';
        }
      }
      Logger.log(`${eventTitle} created for ${contactName} on ${startDate.toDateString()}`);
      return 'created';
    } else {
      Logger.log(`${eventTitle} already exists for ${contactName} on ${startDate.toDateString()}`);
      return 'skipped';
    }
  }
  return 'error';
};

// Create a recurring 'birthday' type event in the primary calendar
// NOTE: Don't add a description, the 'birthday' event type doesn't support it and the API will error
GCalTools.insertBirthdayEvent = function(calendarId, startDate, endDate, eventTitle) {
  const sdd = startDate.getDate();
  const smm = startDate.getMonth() + 1;

  // Exception for Feb 29th!
  const rrule = (smm === 2 && sdd === 29) ? "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1" : "RRULE:FREQ=YEARLY";

  return Calendar.Events.insert({
    start: { date: startDate.getFullYear() + "-" + smm + "-" + sdd },
    end: { date: endDate.getFullYear() + "-" + (endDate.getMonth() + 1) + "-" + endDate.getDate() },
    eventType: 'birthday',
    recurrence: [rrule],
    summary: eventTitle,
    transparency: "transparent",
    visibility: "private",
    reminders: (!useDefaultReminders && reminders.length > 0) ? { useDefault: false, overrides: reminders } : { useDefault: true }
  }, calendarId);
};

// Title + MM-DD, used to match contact dates against existing calendar events
GCalTools.eventKey = function(title, month, day) {
  return `${title}|${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Syncs the primary birthday calendar with contacts:
 * creates missing events and deletes script-created events that no longer match a contact.
 * Only events the API could have created are touched (type 'birthday', no linked contact),
 * so your own birthday and Google's contact-synced events are left alone.
 * Deletion is limited to dates allowed by filterMonths / filterDays.
 */
GCalTools.syncBirthdayCalendar = function(isDryRun) {
  const calendarId = 'primary';
  const stats = { created: 0, kept: 0, deleted: 0, errors: 0 };

  // 1) Index existing script-created birthday events by title + date
  // Recurring exceptions (recurringEventId) are skipped: deleting one would cancel a single occurrence
  const existing = new Map();
  let pageToken = null;
  do {
    const response = Calendar.Events.list(calendarId, { eventTypes: ['birthday'], maxResults: 2500, pageToken: pageToken });
    (response.items || []).forEach(event => {
      if (event.recurringEventId || event.birthdayProperties.type !== 'birthday' || event.birthdayProperties.contact) return;
      const [, mm, dd] = event.start.date.split('-');
      const key = GCalTools.eventKey(event.summary, mm, dd);
      if (!existing.has(key)) existing.set(key, []);
      existing.get(key).push(event);
    });
    pageToken = response.nextPageToken;
  } while (pageToken);

  // 2) Collect the events contacts require, keyed the same way (deduplicates identical title + date)
  // No try/catch: if reading contacts fails, nothing must be deleted
  const wanted = new Map();
  const addWanted = (contactName, date, title) => {
    if (!GCalTools.shouldProcessDate(date)) return;
    const startDate = new Date(date.year || new Date().getFullYear(), date.month - 1, date.day);
    wanted.set(GCalTools.eventKey(title, startDate.getMonth() + 1, startDate.getDate()), { contactName, startDate, title });
  };
  pageToken = null;
  do {
    const response = People.People.Connections.list('people/me', {
      pageSize: 1000,
      personFields: 'names,birthdays,events,memberships',
      pageToken: pageToken
    });
    (response.connections || []).forEach(connection => {
      const hasLabel = (connection.memberships || []).some(m => m.contactGroupMembership && m.contactGroupMembership.contactGroupId.includes(contactLabelID));
      if (onlyContactLabel && !hasLabel) return;
      const contactName = (connection.names || []).length > 0 ? connection.names[0].displayName : 'Unnamed Contact';

      (connection.birthdays || []).forEach(birthday => {
        if (birthday.date) addWanted(contactName, birthday.date, GCalTools.formatEventTitle(birthdayTitleFormat || `{name}'s Birthday`, contactName, "Birthday"));
      });
      if (!onlyBirthdays) {
        (connection.events || []).forEach(event => {
          if (event.date) addWanted(contactName, event.date, GCalTools.formatEventTitle(specialEventTitleFormat || `{name}'s {eventType}`, contactName, event.formattedType || noLabelTitle));
        });
      }
    });
    pageToken = response.nextPageToken;
  } while (pageToken);

  // 3) Keep one matching event per wanted entry, create the rest
  wanted.forEach((item, key) => {
    const matches = existing.get(key);
    if (matches && matches.length > 0) {
      matches.pop();
      stats.kept++;
      return;
    }
    if (isDryRun) {
      Logger.log(`DRY RUN: Would create ${item.title} for ${item.contactName} on ${item.startDate.toDateString()}`);
      stats.created++;
      return;
    }
    const endDate = new Date(item.startDate);
    endDate.setDate(endDate.getDate() + 1);
    try {
      GCalTools.insertBirthdayEvent(calendarId, item.startDate, endDate, item.title);
      Logger.log(`${item.title} created for ${item.contactName} on ${item.startDate.toDateString()}`);
      stats.created++;
    } catch (error) {
      Logger.log(`Error creating event for ${item.contactName}: ${error.message}`);
      stats.errors++;
    }
  });

  // 4) Everything left over (removed contacts, renamed titles, changed dates, duplicates) is deleted
  existing.forEach(events => events.forEach(event => {
    const [, mm, dd] = event.start.date.split('-');
    if (!GCalTools.shouldProcessDate({ month: Number(mm), day: Number(dd) })) return;
    if (isDryRun) {
      Logger.log(`DRY RUN: Would delete ${event.summary} on ${event.start.date}`);
    } else {
      Calendar.Events.remove(calendarId, event.id);
      Logger.log(`Deleted ${event.summary} on ${event.start.date}`);
    }
    stats.deleted++;
  }));

  Logger.log(`Summary: ${isDryRun ? "(dry run) " : ""}kept ${stats.kept}, created ${stats.created}, deleted ${stats.deleted}, errors ${stats.errors}`);
  return stats;
};

// Function to format minutes into a more readable format
GCalTools.formatMinutes = function(minutes) {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes === 60) return "1 hour";
  if (minutes < 1440) {
    const hours = minutes / 60;
    return `${hours} hours`;
  }
  const days = minutes / 1440;
  if (days === 1) return "1 day";
  return `${days} days`;
};

GCalTools.showConfiguration = function() {
  // For standalone execution from script editor
  Logger.log("=== Current Google Dates Configuration ===");

  Logger.log("No Label Title: " + noLabelTitle);
  Logger.log("Only Contact Label: " + onlyContactLabel);
  Logger.log("Contact Label ID: " + contactLabelID);
  Logger.log("Custom Birthday Title Format: " + (birthdayTitleFormat || "(default)"));
  Logger.log("Custom Special Event Title Format: " + (specialEventTitleFormat || "(default)"));
  Logger.log("Add Custom Descriptions: " + addCustomDescriptions);
  Logger.log("Filter by Months: " + (filterMonths.length === 0 ? "All" : filterMonths.sort((a, b) => a - b).join(", ")));
  Logger.log("Filter by Days: " + (filterDays.length === 0 ? "All" : filterDays.sort((a, b) => a - b).join(", ")));
  Logger.log("Delete Search Pattern: " + (deleteSearchPattern || "(default)"));
  Logger.log("Delete Only Future Events: " + deleteOnlyFutureEvents);
  Logger.log("Dry Run Mode: " + dryRun);
  Logger.log("Reminders:");
  if (useDefaultReminders) {
    Logger.log("  Using calendar default reminders");
  } else {
    if (popupReminder1 > 0) Logger.log(`  Popup reminder ${GCalTools.formatMinutes(popupReminder1)} before`);
    if (popupReminder2 > 0) Logger.log(`  Popup reminder ${GCalTools.formatMinutes(popupReminder2)} before`);
    if (emailReminder1 > 0) Logger.log(`  Email reminder ${GCalTools.formatMinutes(emailReminder1)} before`);
    if (emailReminder2 > 0) Logger.log(`  Email reminder ${GCalTools.formatMinutes(emailReminder2)} before`);
    if (popupReminder1 === 0 && popupReminder2 === 0 && emailReminder1 === 0 && emailReminder2 === 0) {
      Logger.log("  No reminders configured");
    }
  }
  Logger.log("=== End of Configuration ===");
  
  return "Configuration has been logged. Check the Logs panel (Ctrl+Enter or Cmd+Enter) to view it.";
};

/**
 * Collects all unique special event labels from user's contacts
 * @return {Array} Array of unique event type labels
 */
GCalTools.collectEventLabels = function() {
  const peopleService = People.People;
  let uniqueLabels = new Set();
  uniqueLabels.add("Birthday"); // Always include Birthday
  uniqueLabels.add(noLabelTitle); // Add the configured noLabelTitle

  try {
    let pageToken = null;
    const pageSize = 100;
    
    do {
      var response = peopleService.Connections.list('people/me', {
        pageSize: pageSize,
        personFields: 'events',
        pageToken: pageToken
      });

      const connections = response.connections || [];
      
      connections.forEach(connection => {
        const events = connection.events || [];
        events.forEach(event => {
          if (event.formattedType) {
            uniqueLabels.add(event.formattedType);
          }
        });
      });
      
      pageToken = response.nextPageToken;
    } while (pageToken);
    
    Logger.log(`Collected ${uniqueLabels.size} unique event labels from contacts`);
    return Array.from(uniqueLabels);
  } catch (error) {
    Logger.log("Error collecting event labels: " + error.message);
    // Return default labels if there's an error
    return ["Birthday", "Anniversary", noLabelTitle, "Special Event"];
  }
};

/**
 * Delete events from a calendar matching criteria
 * @param {string} calendarId - ID of the calendar to delete events from
 * @param {string|Array} pattern - Text pattern or array of patterns to match in event titles
 * @param {boolean} onlyFutureEvents - Whether to only delete future events
 * @param {boolean} isDryRun - Whether to simulate deletion without actually deleting
 * @return {number} Number of events deleted
 */
GCalTools.deleteEvents = function(calendarId, pattern, onlyFutureEvents, isDryRun) {
  var eventsDeleted = 0;

  // Convert single pattern to array for consistency
  var patterns = Array.isArray(pattern) ? pattern : [pattern];
  
  try {
    // First validate that the calendar exists before proceeding
    try {
      var calendar = CalendarApp.getCalendarById(calendarId);
      if (!calendar) {
        Logger.log(`Error: Calendar not found or invalid ID: ${calendarId}`);
        return -1; // Return a special code to indicate calendar not found
      }
    } catch (calError) {
      Logger.log(`Error: Calendar not found or invalid ID: ${calendarId}`);
      return -1; // Return a special code to indicate calendar not found
    }
    
    // For secondary calendars, get all event labels from contacts to use as patterns
    if (calendarId !== "primary" && !useOriginalBirthdayCalendar) {
      if (!onlyBirthdays) {
        // Add all unique event labels from contacts to our patterns
        var contactEventLabels = GCalTools.collectEventLabels();
        patterns = patterns.concat(contactEventLabels);
        // Remove duplicates
        patterns = [...new Set(patterns)];
      }
    }
    
    if (isDryRun) {
      Logger.log("DRY RUN: Will search for events with these patterns: " + patterns.join(", "));
    }
    
    var pageToken;
    do {
      var optionalArgs = { 
        pageToken: pageToken,
      };
      
      // Only get future events if enabled
      if (onlyFutureEvents) {
        var today = new Date();
        optionalArgs.timeMin = today.toISOString();
      }
      
      var response = Calendar.Events.list(calendarId, optionalArgs);
      var events = response.items;
      
      if (!events || events.length === 0) {
        Logger.log("No events found.");
        return eventsDeleted;
      }
      
      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        
        // For primary calendar, use the birthday event type
        var shouldDelete = (calendarId === "primary" && event.eventType === "birthday");
        
        // For secondary calendars ONLY, match against our patterns
        if (!shouldDelete && calendarId !== "primary" && event.summary && patterns && patterns.length > 0) {
          shouldDelete = patterns.some(p => event.summary.includes(p));
        }

        if (shouldDelete) {
          if (isDryRun) {
            Logger.log("DRY RUN: Would delete event: " + event.summary);
          } else {
            Calendar.Events.remove(calendarId, event.id);
            Logger.log("Deleted event: " + event.summary);
          }
          eventsDeleted++;
        }
      }
      
      pageToken = response.nextPageToken;
    } while (pageToken);
    
    Logger.log(`Total events ${isDryRun ? "that would be" : ""} deleted: ${eventsDeleted}`);
    return eventsDeleted;
  } catch (e) {
    Logger.log("Error: " + e.message);
    return eventsDeleted;
  }
};
