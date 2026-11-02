(function () {
  var nameInput = document.getElementById("f-name");
  var classSelect = document.getElementById("f-class");
  var classOtherInput = document.getElementById("f-class-other");
  var subjectSelect = document.getElementById("f-subject");
  var titleInput = document.getElementById("f-title");
  var fileInput = document.getElementById("f-file");
  var submitBtn = document.getElementById("btn-submit");
  var statusEl = document.getElementById("submit-status");
  var maxSizeLabel = document.getElementById("max-size-label");
  var historyPlaceholder = document.getElementById("history-placeholder");
  var historyTable = document.getElementById("history-table");
  var historyBody = document.getElementById("history-body");

  var NAME_KEY = "submitWork.studentName";
  var CLASS_KEY = "submitWork.className";

  maxSizeLabel.textContent = CONFIG.MAX_FILE_MB;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
    } catch (e) {
      return String(iso);
    }
  }

  function loadSavedIdentity() {
    var savedName = localStorage.getItem(NAME_KEY);
    var savedClass = localStorage.getItem(CLASS_KEY);
    if (savedName) nameInput.value = savedName;
    if (savedClass) classSelect.value = savedClass;
  }

  function saveIdentity() {
    if (nameInput.value.trim()) localStorage.setItem(NAME_KEY, nameInput.value.trim());
    if (classSelect.value) localStorage.setItem(CLASS_KEY, classSelect.value);
  }

  function populateClassrooms() {
    fetch("data/classrooms.json", { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (list) {
        list.forEach(function (c) {
          var opt = document.createElement("option");
          opt.value = c;
          opt.textContent = c;
          classSelect.appendChild(opt);
        });
        loadSavedIdentity();
      })
      .catch(function () {});
  }

  function populateSubjects() {
    fetch("data/subjects.json", { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (list) {
        list.forEach(function (s) {
          var opt = document.createElement("option");
          opt.value = s.code;
          opt.textContent = s.code + " " + s.name;
          opt.dataset.name = s.name;
          subjectSelect.appendChild(opt);
        });
      })
      .catch(function () {});
  }

  function getClassName() {
    return classOtherInput.value.trim() || classSelect.value;
  }

  function showStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = "status-msg" + (kind ? " " + kind : "");
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = reader.result;
        var base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function apiPost(body) {
    return fetch(CONFIG.API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json();
    });
  }

  submitBtn.addEventListener("click", function () {
    var name = nameInput.value.trim();
    var className = getClassName();
    var subjectOpt = subjectSelect.options[subjectSelect.selectedIndex];
    var subjectCode = subjectSelect.value;
    var title = titleInput.value.trim();
    var file = fileInput.files[0];

    if (!name) return showStatus("กรุณากรอกชื่อ-สกุล", "error");
    if (!className) return showStatus("กรุณาเลือกหรือกรอกห้องเรียน", "error");
    if (!subjectCode) return showStatus("กรุณาเลือกวิชา", "error");
    if (!title) return showStatus("กรุณาตั้งชื่องาน/หัวข้อที่ส่ง", "error");
    if (!file) return showStatus("กรุณาเลือกไฟล์", "error");
    if (file.size > CONFIG.MAX_FILE_MB * 1024 * 1024) {
      return showStatus("ไฟล์ใหญ่เกิน " + CONFIG.MAX_FILE_MB + " MB", "error");
    }
    if (!CONFIG.API_URL) {
      return showStatus("ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล (API_URL ว่าง) ติดต่ออาจารย์", "error");
    }

    saveIdentity();
    submitBtn.disabled = true;
    showStatus("กำลังอัปโหลด...");

    fileToBase64(file)
      .then(function (base64) {
        return apiPost({
          action: "submit",
          studentName: name,
          className: className,
          subjectCode: subjectCode,
          subjectName: subjectOpt ? subjectOpt.dataset.name : "",
          title: title,
          fileName: file.name,
          mimeType: file.type,
          fileDataBase64: base64,
        });
      })
      .then(function (res) {
        submitBtn.disabled = false;
        if (res && res.ok) {
          showStatus("ส่งไฟล์งานสำเร็จ", "success");
          titleInput.value = "";
          fileInput.value = "";
          loadHistory();
        } else {
          showStatus("ส่งไม่สำเร็จ: " + (res && res.error ? res.error : "unknown error"), "error");
        }
      })
      .catch(function (err) {
        submitBtn.disabled = false;
        showStatus("ส่งไม่สำเร็จ: " + err.message, "error");
      });
  });

  function loadHistory() {
    var name = nameInput.value.trim();
    if (!name || !CONFIG.API_URL) {
      historyPlaceholder.hidden = false;
      historyPlaceholder.textContent = CONFIG.API_URL
        ? "กรอกชื่อ-สกุลด้านบนเพื่อดูประวัติการส่งงาน"
        : "ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล";
      historyTable.hidden = true;
      return;
    }

    fetch(CONFIG.API_URL, { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var mine = (data.submissions || []).filter(function (s) {
          return s.studentName.trim().toLowerCase() === name.toLowerCase();
        });
        mine.sort(function (a, b) {
          return new Date(b.loggedAt) - new Date(a.loggedAt);
        });

        if (!mine.length) {
          historyPlaceholder.hidden = false;
          historyPlaceholder.textContent = "ยังไม่มีประวัติการส่งงาน";
          historyTable.hidden = true;
          return;
        }

        historyPlaceholder.hidden = true;
        historyTable.hidden = false;
        historyBody.innerHTML = mine
          .map(function (s) {
            var graded = s.score !== "" && s.score !== undefined && s.score !== null;
            return (
              "<tr>" +
              "<td>" + fmtDate(s.loggedAt) + "</td>" +
              "<td>" + escapeHtml(s.subjectName) + "</td>" +
              "<td>" + escapeHtml(s.className) + "</td>" +
              "<td>" + escapeHtml(s.title) + "</td>" +
              '<td><a href="' + s.fileUrl + '" target="_blank" rel="noopener">' + escapeHtml(s.fileName) + "</a></td>" +
              "<td>" + (graded ? '<span class="pill graded">' + escapeHtml(s.score) + "</span>" : '<span class="pill ungraded">ยังไม่ให้คะแนน</span>') + "</td>" +
              "<td>" + escapeHtml(s.comment || "") + "</td>" +
              "</tr>"
            );
          })
          .join("");
      })
      .catch(function () {
        historyPlaceholder.hidden = false;
        historyPlaceholder.textContent = "โหลดประวัติไม่สำเร็จ";
        historyTable.hidden = true;
      });
  }

  nameInput.addEventListener("change", loadHistory);
  nameInput.addEventListener("blur", loadHistory);

  populateClassrooms();
  populateSubjects();
  setTimeout(loadHistory, 300);
})();
