(function () {
  var gate = document.getElementById("gate");
  var dashboard = document.getElementById("dashboard");
  var passcodeInput = document.getElementById("f-passcode");
  var loginBtn = document.getElementById("btn-login");
  var loginStatus = document.getElementById("login-status");
  var filterClass = document.getElementById("filter-class");
  var filterSubject = document.getElementById("filter-subject");
  var refreshBtn = document.getElementById("btn-refresh");
  var listPlaceholder = document.getElementById("list-placeholder");
  var listTable = document.getElementById("list-table");
  var listBody = document.getElementById("list-body");

  var PASSCODE_KEY = "submitWork.teacherPasscode";
  var passcode = "";
  var allSubmissions = [];

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

  function apiPost(body) {
    return fetch(CONFIG.API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json();
    });
  }

  function tryLogin(pc) {
    loginStatus.textContent = "กำลังตรวจสอบ...";
    loginStatus.className = "status-msg";
    apiPost({ action: "adminCheckPasscode", passcode: pc })
      .then(function (res) {
        if (res && res.ok) {
          passcode = pc;
          sessionStorage.setItem(PASSCODE_KEY, pc);
          gate.hidden = true;
          dashboard.hidden = false;
          refresh();
        } else {
          loginStatus.textContent = "รหัสผ่านไม่ถูกต้อง";
          loginStatus.className = "status-msg error";
        }
      })
      .catch(function (err) {
        loginStatus.textContent = "เชื่อมต่อไม่สำเร็จ: " + err.message;
        loginStatus.className = "status-msg error";
      });
  }

  loginBtn.addEventListener("click", function () {
    var pc = passcodeInput.value.trim();
    if (!pc) return;
    tryLogin(pc);
  });

  passcodeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") loginBtn.click();
  });

  function populateFilterOptions() {
    var classes = {};
    var subjects = {};
    allSubmissions.forEach(function (s) {
      if (s.className) classes[s.className] = true;
      if (s.subjectCode) subjects[s.subjectCode + "|" + s.subjectName] = true;
    });

    var currentClass = filterClass.value;
    filterClass.innerHTML = '<option value="">-- ทุกห้องเรียน --</option>';
    Object.keys(classes)
      .sort()
      .forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        filterClass.appendChild(opt);
      });
    filterClass.value = currentClass;

    var currentSubject = filterSubject.value;
    filterSubject.innerHTML = '<option value="">-- ทุกวิชา --</option>';
    Object.keys(subjects)
      .sort()
      .forEach(function (key) {
        var parts = key.split("|");
        var opt = document.createElement("option");
        opt.value = parts[0];
        opt.textContent = parts[0] + " " + parts[1];
        filterSubject.appendChild(opt);
      });
    filterSubject.value = currentSubject;
  }

  function renderList() {
    var filtered = allSubmissions.filter(function (s) {
      if (filterClass.value && s.className !== filterClass.value) return false;
      if (filterSubject.value && s.subjectCode !== filterSubject.value) return false;
      return true;
    });

    filtered.sort(function (a, b) {
      return new Date(b.loggedAt) - new Date(a.loggedAt);
    });

    if (!filtered.length) {
      listPlaceholder.hidden = false;
      listPlaceholder.textContent = "ยังไม่มีไฟล์งานที่ส่ง";
      listTable.hidden = true;
      return;
    }

    listPlaceholder.hidden = true;
    listTable.hidden = false;
    listBody.innerHTML = filtered
      .map(function (s) {
        return (
          '<tr data-id="' + escapeHtml(s.id) + '">' +
          "<td>" + fmtDate(s.loggedAt) + "</td>" +
          "<td>" + escapeHtml(s.studentName) + "</td>" +
          "<td>" + escapeHtml(s.className) + "</td>" +
          "<td>" + escapeHtml(s.subjectName) + "</td>" +
          "<td>" + escapeHtml(s.title) + "</td>" +
          '<td><a href="' + s.folderUrl + '" target="_blank" rel="noopener" title="' + escapeHtml(s.fileNames || "") + '">' + escapeHtml(s.fileCount) + " ไฟล์</a></td>" +
          '<td><input type="text" class="score-input" value="' + escapeHtml(s.score || "") + '" /></td>' +
          '<td><input type="text" class="comment-input" value="' + escapeHtml(s.comment || "") + '" /></td>' +
          '<td><button class="btn small btn-save">บันทึก</button></td>' +
          "</tr>"
        );
      })
      .join("");
  }

  listBody.addEventListener("click", function (e) {
    if (!e.target.classList.contains("btn-save")) return;
    var row = e.target.closest("tr");
    var id = row.dataset.id;
    var score = row.querySelector(".score-input").value.trim();
    var comment = row.querySelector(".comment-input").value.trim();
    e.target.disabled = true;
    e.target.textContent = "...";
    apiPost({ action: "setScore", id: id, score: score, comment: comment, passcode: passcode })
      .then(function (res) {
        e.target.disabled = false;
        if (res && res.ok) {
          e.target.textContent = "บันทึกแล้ว";
          var sub = allSubmissions.filter(function (s) {
            return s.id === id;
          })[0];
          if (sub) {
            sub.score = score;
            sub.comment = comment;
          }
          setTimeout(function () {
            e.target.textContent = "บันทึก";
          }, 1500);
        } else {
          e.target.textContent = "ผิดพลาด";
        }
      })
      .catch(function () {
        e.target.disabled = false;
        e.target.textContent = "ผิดพลาด";
      });
  });

  function refresh() {
    if (!CONFIG.API_URL) {
      listPlaceholder.textContent = "ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล";
      return;
    }
    listPlaceholder.hidden = false;
    listPlaceholder.textContent = "กำลังโหลด...";
    listTable.hidden = true;
    fetch(CONFIG.API_URL, { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        allSubmissions = data.submissions || [];
        populateFilterOptions();
        renderList();
      })
      .catch(function () {
        listPlaceholder.textContent = "โหลดข้อมูลไม่สำเร็จ";
      });
  }

  filterClass.addEventListener("change", renderList);
  filterSubject.addEventListener("change", renderList);
  refreshBtn.addEventListener("click", refresh);

  var savedPasscode = sessionStorage.getItem(PASSCODE_KEY);
  if (savedPasscode) {
    tryLogin(savedPasscode);
  }
})();
