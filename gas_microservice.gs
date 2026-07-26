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
    } else if (action === "sendEmail") {
      response.data = sendEmail(data);
    } else {
      response.status = "error";
      response.error = "Invalid or missing action. Available: ping, getCalendarEvents, createCalendarEvent, getEmails, replyEmail, sendEmail";
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
    return {
      id: e.getId(),
      title: e.getTitle(),
      startTime: e.getStartTime().toISOString(),
      endTime: e.getEndTime().toISOString(),
      isAllDay: e.isAllDayEvent(),
      location: e.getLocation(),
      description: e.getDescription()
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
  var options = {};
  if (data.location) options.location = data.location;
  if (data.description) options.description = data.description;
  
  var event = cal.createEvent(data.title, start, end, options);
  return {
    success: true,
    id: event.getId(),
    title: event.getTitle(),
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
  var count = parseInt(maxResults || 15, 10);
  var q = query || "inbox";
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
        return {
          id: m.getId(),
          from: m.getFrom(),
          to: m.getTo(),
          date: m.getDate().toISOString(),
          subject: m.getSubject(),
          snippet: getSnippetText(m),
          body: m.getPlainBody() || m.getBody()
        };
      })
    });
  }
  return resultList;
}

function replyEmail(data) {
  if (!data.body) {
    throw new Error("Missing reply body content");
  }
  
  if (data.threadId) {
    var thread = GmailApp.getThreadById(data.threadId);
    thread.reply(data.body);
    return { success: true, message: "Replied to email thread successfully" };
  } else if (data.messageId) {
    var msg = GmailApp.getMessageById(data.messageId);
    msg.reply(data.body);
    return { success: true, message: "Replied to email message successfully" };
  }
  throw new Error("Missing threadId or messageId");
}

function sendEmail(data) {
  if (!data.to || !data.subject || !data.body) {
    throw new Error("Missing required parameters: to, subject, body");
  }
  GmailApp.sendEmail(data.to, data.subject, data.body);
  return { success: true, message: "Email sent successfully" };
}
