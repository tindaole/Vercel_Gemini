/**
 * Google Apps Script Microservice for MyBoard Dashboard
 * 
 * Instructions:
 * 1. Open https://script.google.com and click "New project".
 * 2. Delete existing code, paste this entire file into Code.gs.
 * 3. Click "Deploy" -> "New deployment".
 * 4. Select type: "Web app".
 * 5. Configuration:
 *    - Description: MyBoard Microservice
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone
 * 6. Click "Deploy", authorize permissions when prompted.
 * 7. Copy the generated Web App URL (ends with /exec) and paste it into MyBoard Settings!
 */

function handleRequest(e) {
  var action = "";
  var data = {};
  
  if (e && e.parameter && e.parameter.action) {
    action = e.parameter.action;
    data = e.parameter;
  }
  
  if (e && e.postData && e.postData.contents) {
    try {
      var parsed = JSON.parse(e.postData.contents);
      if (parsed.action) action = parsed.action;
      data = Object.assign({}, data, parsed);
    } catch (err) {}
  }
  
  var response = { status: "success", timestamp: new Date().toISOString() };
  
  try {
    if (action === "ping") {
      response.data = { message: "Google Apps Script Microservice is online and connected!", user: Session.getActiveUser().getEmail() };
    } else if (action === "getCalendarEvents") {
      response.data = getCalendarEvents(data.days);
    } else if (action === "createCalendarEvent") {
      response.data = createCalendarEvent(data);
    } else if (action === "getEmails") {
      response.data = getEmails(data.maxResults, data.query);
    } else if (action === "replyEmail") {
      response.data = replyEmail(data);
    } else if (action === "replyAllEmail") {
      response.data = replyAllEmail(data);
    } else if (action === "forwardEmail") {
      response.data = forwardEmail(data);
    } else if (action === "deleteEmail") {
      response.data = deleteEmail(data);
    } else if (action === "markReadEmail") {
      response.data = markReadEmail(data);
    } else if (action === "sendEmail") {
      response.data = sendEmail(data);
    } else if (action === "getTasks") {
      response.data = getTasks();
    } else if (action === "saveTasks") {
      response.data = saveTasks(data.tasksList);
    } else if (action === "setupTelegramTrigger") {
      response.data = setupTelegramTrigger();
    } else if (action === "testTelegramMessage") {
      response.data = sendDailyTelegramReminder();
    } else {
      response.status = "error";
      response.error = "Invalid or missing action. Available: ping, getCalendarEvents, createCalendarEvent, getEmails, replyEmail, replyAllEmail, forwardEmail, deleteEmail, markReadEmail, sendEmail, getTasks, saveTasks, setupTelegramTrigger, testTelegramMessage";
    }
  } catch (err) {
    response.status = "error";
    response.error = err.toString();
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

/**
 * Calendar Functions
 */
function getCalendarEvents(days) {
  var numDays = parseInt(days || 7, 10);
  var now = new Date();
  var end = new Date(now.getTime() + numDays * 24 * 60 * 60 * 1000);
  
  var events = CalendarApp.getDefaultCalendar().getEvents(now, end);
  return events.map(function(e) {
    var rawTitle = e.getTitle() || "";
    var category = "Work";
    var displayTitle = rawTitle;

    // Detect category from tag or title prefix
    var tagCategory = "";
    try { tagCategory = e.getTag("category"); } catch (err) {}

    if (tagCategory) {
      category = tagCategory;
    } else if (rawTitle.indexOf("[") === 0 && rawTitle.indexOf("]") > 0) {
      category = rawTitle.substring(1, rawTitle.indexOf("]"));
      displayTitle = rawTitle.substring(rawTitle.indexOf("]") + 1).trim();
    }

    var popupReminders = [];
    try { popupReminders = e.getPopupReminders(); } catch (err) {}

    return {
      id: e.getId(),
      title: displayTitle,
      fullTitle: rawTitle,
      category: category,
      colorId: e.getColor() || "2",
      startTime: e.getStartTime().toISOString(),
      endTime: e.getEndTime().toISOString(),
      isAllDay: e.isAllDayEvent(),
      location: e.getLocation(),
      description: e.getDescription(),
      hasReminder: popupReminders.length > 0,
      reminderMinutes: popupReminders.length > 0 ? popupReminders[0] : 0
    };
  });
}

function createCalendarEvent(data) {
  if (!data.title || !data.startTime) {
    throw new Error("Missing required parameters: title and startTime");
  }
  var cal = CalendarApp.getDefaultCalendar();
  var start = new Date(data.startTime);
  var end = data.endTime ? new Date(data.endTime) : new Date(start.getTime() + 60 * 60 * 1000);
  
  var category = data.category || "Work";
  var fullTitle = "[" + category + "] " + data.title;

  var options = {};
  if (data.location) options.location = data.location;
  if (data.description) options.description = data.description;

  var event = cal.createEvent(fullTitle, start, end, options);

  // Set event color & tag
  var colorMap = { "Personal": "1", "Work": "2", "Meeting": "3", "Urgent": "4", "Other": "8" };
  var colorId = data.colorId || colorMap[category] || "2";
  try {
    event.setColor(colorId);
    event.setTag("category", category);
  } catch (err) {}

  // Set Reminders
  if (data.enableReminder) {
    var mins = parseInt(data.reminderMinutes || 15, 10);
    try {
      event.addPopupReminder(mins);
      event.addEmailReminder(mins);
    } catch (err) {}
  }

  return {
    success: true,
    id: event.getId(),
    title: event.getTitle(),
    category: category,
    startTime: event.getStartTime().toISOString()
  };
}

/**
 * Gmail Functions
 */
function getSnippetText(msg) {
  if (!msg) return "";
  try {
    var plain = msg.getPlainBody() || "";
    var cleaned = plain.replace(/\s+/g, " ").trim();
    return cleaned.length > 160 ? cleaned.substring(0, 160) + "..." : cleaned;
  } catch (err) {
    return "";
  }
}

function getEmails(maxResults, query) {
  var count = parseInt(maxResults || 10, 10);
  var q = query || "category:primary in:inbox";
  var threads = GmailApp.search(q, 0, count);
  var resultList = [];
  
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();
    var lastMsg = messages[messages.length - 1];
    
    var firstMsgSubject = messages.length > 0 ? messages[0].getSubject() : "";
    var lastMsgSubject = lastMsg ? lastMsg.getSubject() : "";
    
    resultList.push({
      threadId: thread.getId(),
      messageId: lastMsg ? lastMsg.getId() : "",
      unread: thread.isUnread(),
      subject: firstMsgSubject || lastMsgSubject || "(No Subject)",
      sender: lastMsg ? lastMsg.getFrom() : "",
      date: lastMsg ? lastMsg.getDate().toISOString() : new Date().toISOString(),
      snippet: getSnippetText(lastMsg),
      messageCount: thread.getMessageCount(),
      messages: messages.map(function(m) {
        var rawAtts = m.getAttachments();
        var attachments = rawAtts.map(function(att) {
          var size = att.getSize();
          var item = {
            name: att.getName(),
            mimeType: att.getContentType(),
            size: size
          };
          if (size <= 4 * 1024 * 1024) {
            try {
              var base64 = Utilities.base64Encode(att.getBytes());
              item.dataUrl = "data:" + att.getContentType() + ";base64," + base64;
            } catch (e) {}
          }
          return item;
        });

        return {
          id: m.getId(),
          from: m.getFrom(),
          to: m.getTo(),
          date: m.getDate().toISOString(),
          subject: m.getSubject(),
          snippet: getSnippetText(m),
          htmlBody: m.getBody() || "",
          plainBody: m.getPlainBody() || "",
          body: m.getBody() || m.getPlainBody() || "",
          attachments: attachments
        };
      })
    });
  }
  return resultList;
}

function replyEmail(data) {
  if (!data.body) throw new Error("Missing reply body content");
  
  if (data.threadId) {
    var thread = GmailApp.getThreadById(data.threadId);
    thread.reply(data.body);
    return { success: true, message: "Replied to email thread successfully" };
  }
  throw new Error("Missing threadId");
}

function replyAllEmail(data) {
  if (!data.body) throw new Error("Missing reply body content");
  
  if (data.threadId) {
    var thread = GmailApp.getThreadById(data.threadId);
    thread.replyAll(data.body);
    return { success: true, message: "Replied all to email thread successfully" };
  }
  throw new Error("Missing threadId");
}

function forwardEmail(data) {
  if (!data.to || !data.threadId) throw new Error("Missing recipient 'to' or 'threadId'");
  
  var thread = GmailApp.getThreadById(data.threadId);
  var messages = thread.getMessages();
  var lastMsg = messages[messages.length - 1];
  
  var options = {};
  if (data.body) options.htmlBody = data.body;
  lastMsg.forward(data.to, options);
  
  return { success: true, message: "Forwarded email successfully" };
}

function deleteEmail(data) {
  if (!data.threadId) throw new Error("Missing threadId");
  
  var thread = GmailApp.getThreadById(data.threadId);
  thread.moveToTrash();
  return { success: true, message: "Email moved to trash successfully" };
}

function markReadEmail(data) {
  if (!data.threadId) throw new Error("Missing threadId");
  
  var thread = GmailApp.getThreadById(data.threadId);
  thread.markRead();
  return { success: true, message: "Email marked as read successfully" };
}

function sendEmail(data) {
  if (!data.to || !data.subject || !data.body) {
    throw new Error("Missing required parameters: to, subject, body");
  }
  GmailApp.sendEmail(data.to, data.subject, data.body);
  return { success: true, message: "Email sent successfully" };
}

/**
 * Google Sheets To-Do Tasks Functions
 */
function getOrCreateTasksSheet() {
  var fileName = "MyBoard Tasks";
  var files = DriveApp.getFilesByName(fileName);
  var ss;
  
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(fileName);
    var sheet = ss.getSheets()[0];
    sheet.setName("Tasks");
    sheet.appendRow(["ID", "Title", "Important", "Urgent", "Completed", "CreatedAt"]);
  }
  
  return ss.getSheetByName("Tasks");
}

function getTasks() {
  var sheet = getOrCreateTasksSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var tasks = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue; // Skip empty rows
    tasks.push({
      id: row[0].toString(),
      title: row[1].toString(),
      important: row[2] === true || row[2] === "true",
      urgent: row[3] === true || row[3] === "true",
      completed: row[4] === true || row[4] === "true",
      createdAt: row[5] ? row[5].toString() : ""
    });
  }
  return tasks;
}

function saveTasks(tasksList) {
  var sheet = getOrCreateTasksSheet();
  sheet.clearContents();
  sheet.appendRow(["ID", "Title", "Important", "Urgent", "Completed", "CreatedAt"]);
  
  if (tasksList && tasksList.length > 0) {
    var rows = tasksList.map(function(task) {
      return [
        task.id || "",
        task.title || "",
        task.important === true || task.important === "true",
        task.urgent === true || task.urgent === "true",
        task.completed === true || task.completed === "true",
        task.createdAt || new Date().toISOString()
      ];
    });
    sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  }
  return { success: true, count: tasksList ? tasksList.length : 0 };
}

/**
 * Telegram Notifications Functions
 */
function setupTelegramTrigger() {
  var triggerName = "sendDailyTelegramReminder";
  var triggers = ScriptApp.getProjectTriggers();
  var exists = false;
  
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === triggerName) {
      exists = true;
      break;
    }
  }
  
  if (!exists) {
    ScriptApp.newTrigger(triggerName)
      .timeBased()
      .everyDays(1)
      .atHour(19) // 7:00 PM
      .nearMinute(0)
      .create();
  }
  
  return { success: true, message: "Daily Telegram trigger set up successfully at 7:00 PM." };
}

function sendDailyTelegramReminder() {
  var props = PropertiesService.getScriptProperties();
  var botToken = props.getProperty("TELEGRAM_BOT_TOKEN");
  var chatId = props.getProperty("TELEGRAM_CHAT_ID");
  
  if (!botToken || !chatId) {
    throw new Error("Missing script properties: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in Google Apps Script properties.");
  }
  
  var tasks = getTasks();
  var q1Incomplete = tasks.filter(function(t) {
    return t.important && t.urgent && !t.completed;
  });
  
  var messageText = "";
  if (q1Incomplete.length > 0) {
    messageText = "🔔 *NHẮC NHỞ CÔNG VIỆC KHẢN CẤP (7:00 PM)*\n\n" +
                  "Bạn có " + q1Incomplete.length + " công việc *Quan trọng & Khẩn cấp* chưa hoàn thành:\n\n" +
                  q1Incomplete.map(function(t, idx) {
                    return (idx + 1) + ". " + t.title;
                  }).join("\n") +
                  "\n\nHãy hoàn thành chúng nhé! 💪";
  } else {
    messageText = "🎉 *NHẮC NHỞ CÔNG VIỆC (7:00 PM)*\n\n" +
                  "Chúc mừng! Bạn đã hoàn thành tất cả công việc *Quan trọng & Khẩn cấp* hôm nay! Chúc bạn có một buổi tối thư giãn! 🌟";
  }
  
  var url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
  var payload = {
    chat_id: chatId,
    text: messageText,
    parse_mode: "Markdown"
  };
  
  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  var resText = response.getContentText();
  var resJson = JSON.parse(resText);
  if (response.getResponseCode() !== 200) {
    throw new Error("Telegram API Error: " + (resJson.description || resText));
  }
  
  return { success: true, message: "Telegram message sent successfully!", response: resJson };
}
