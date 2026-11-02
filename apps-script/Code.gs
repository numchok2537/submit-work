var SHEET_NAME = "Submissions";
var HEADERS = [
  "id",
  "loggedAt",
  "studentName",
  "className",
  "subjectCode",
  "subjectName",
  "title",
  "fileCount",
  "fileNames",
  "folderUrl",
  "folderId",
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
  lock.waitLock(25000);
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

// data.files = [{ fileName, mimeType, fileDataBase64, relativePath }], relativePath
// is the path *inside* the submission (e.g. "src/index.html") so folder
// structure a student picked via "เลือกทั้งโฟลเดอร์" is preserved.
function handleSubmit_(data) {
  var folder = getRootFolder_();
  var subjectFolder = getOrCreateChildFolder_(folder, data.subjectCode + " " + data.subjectName);
  var classFolder = getOrCreateChildFolder_(subjectFolder, data.className);
  var submissionFolder = classFolder.createFolder(data.studentName + " - " + data.title);

  var fileNames = [];
  (data.files || []).forEach(function (f) {
    var segments = String(f.relativePath || f.fileName).split("/").filter(function (s) {
      return s.length > 0;
    });
    var fileName = segments.pop();
    var targetFolder = submissionFolder;
    segments.forEach(function (seg) {
      targetFolder = getOrCreateChildFolder_(targetFolder, seg);
    });
    var blob = Utilities.newBlob(
      Utilities.base64Decode(f.fileDataBase64),
      f.mimeType || "application/octet-stream",
      fileName
    );
    targetFolder.createFile(blob);
    fileNames.push(f.relativePath || f.fileName);
  });

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
    fileNames.length,
    fileNames.join(", "),
    submissionFolder.getUrl(),
    submissionFolder.getId(),
    "",
    "",
    "",
  ]);

  return jsonOut_({ ok: true, id: id, folderUrl: submissionFolder.getUrl() });
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
      sheet.getRange(row, 12).setValue(data.score); // score column
      sheet.getRange(row, 13).setValue(data.comment || ""); // comment column
      sheet.getRange(row, 14).setValue(new Date()); // gradedAt column
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
      fileCount: r[7],
      fileNames: r[8],
      folderUrl: r[9],
      folderId: r[10],
      score: r[11],
      comment: r[12],
      gradedAt: r[13],
    };
  });
  return jsonOut_({ submissions: rows });
}
