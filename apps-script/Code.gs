var SHEET_NAME = "Submissions";
var HEADERS = [
  "id",
  "loggedAt",
  "studentName",
  "className",
  "subjectCode",
  "subjectName",
  "title",
  "fileName",
  "fileUrl",
  "fileId",
  "score",
  "comment",
  "gradedAt",
];
var ROOT_FOLDER_PROP = "ROOT_FOLDER_ID";
var ADMIN_PASSCODE_PROP = "ADMIN_PASSCODE";
var DEFAULT_PASSCODE = "1234";

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function getRootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(ROOT_FOLDER_PROP);
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      // fall through and recreate if the stored id is no longer valid
    }
  }
  var folder = DriveApp.getRootFolder().createFolder("ไฟล์งานนักเรียน (ส่งผ่านเว็บ)");
  props.setProperty(ROOT_FOLDER_PROP, folder.getId());
  return folder;
}

function getAdminPasscode_() {
  return PropertiesService.getScriptProperties().getProperty(ADMIN_PASSCODE_PROP) || DEFAULT_PASSCODE;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function newId_() {
  return "sub-" + Utilities.getUuid().slice(0, 8);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action;

  if (action === "submit") {
    return withLock_(function () {
      return handleSubmit_(data);
    });
  }
  if (action === "setScore") {
    return withLock_(function () {
      return handleSetScore_(data);
    });
  }
  if (action === "adminCheckPasscode") {
    return jsonOut_({ ok: data.passcode === getAdminPasscode_() });
  }

  return jsonOut_({ error: "unknown action" });
}

function handleSubmit_(data) {
  var folder = getRootFolder_();
  var subjectFolder = getOrCreateChildFolder_(folder, data.subjectCode + " " + data.subjectName);
  var classFolder = getOrCreateChildFolder_(subjectFolder, data.className);

  var blob = Utilities.newBlob(
    Utilities.base64Decode(data.fileDataBase64),
    data.mimeType || "application/octet-stream",
    data.fileName
  );
  var file = classFolder.createFile(blob);
  file.setName(data.studentName + " - " + data.title + " - " + data.fileName);

  var sheet = getSheet_();
  var id = newId_();
  sheet.appendRow([
    id,
    new Date(),
    data.studentName,
    data.className,
    data.subjectCode,
    data.subjectName,
    data.title,
    data.fileName,
    file.getUrl(),
    file.getId(),
    "",
    "",
    "",
  ]);

  return jsonOut_({ ok: true, id: id, fileUrl: file.getUrl() });
}

function getOrCreateChildFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function handleSetScore_(data) {
  if (data.passcode !== getAdminPasscode_()) {
    return jsonOut_({ error: "wrong passcode" });
  }
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === data.id) {
      var row = i + 1;
      sheet.getRange(row, 11).setValue(data.score); // score column
      sheet.getRange(row, 12).setValue(data.comment || ""); // comment column
      sheet.getRange(row, 13).setValue(new Date()); // gradedAt column
      return jsonOut_({ ok: true });
    }
  }
  return jsonOut_({ error: "submission not found" });
}

function doGet(e) {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var rows = values.slice(1).map(function (r) {
    return {
      id: r[0],
      loggedAt: r[1],
      studentName: r[2],
      className: r[3],
      subjectCode: r[4],
      subjectName: r[5],
      title: r[6],
      fileName: r[7],
      fileUrl: r[8],
      fileId: r[9],
      score: r[10],
      comment: r[11],
      gradedAt: r[12],
    };
  });
  return jsonOut_({ submissions: rows });
}
