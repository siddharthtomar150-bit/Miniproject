/**
 * ==========================================================================
 * Student Performance Tracker - Frontend API Controller
 * ==========================================================================
 * Technology: Pure Vanilla JavaScript (ES6+) with Fetch API
 * Backend: FastAPI + SQLAlchemy + SQLite (Source of Truth)
 * ==========================================================================
 */

// ==========================================================================
// 1. CONFIGURATION & STATE
// ==========================================================================

/**
 * Base URL for FastAPI Backend.
 * Automatically adapts:
 * - When deployed or served directly by FastAPI: uses window.location.origin (same-origin, zero CORS)
 * - When run via VS Code Live Server (port 5500): auto-detects port 8000 / 8001
 */
function getDefaultBaseURL() {
  if (
    window.location.protocol.startsWith("http") &&
    window.location.port !== "5500" &&
    window.location.port !== "3000"
  ) {
    return window.location.origin;
  }
  const host = window.location.hostname === "localhost" ? "localhost" : "127.0.0.1";
  return `http://${host}:8000`;
}

let API_BASE_URL = getDefaultBaseURL();

/**
 * Health check helper for resolving active backend URL
 */
async function checkHealth(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1000);
  try {
    const res = await fetch(`${url}/api/health`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === "online") return url;
    }
  } catch (e) {
    clearTimeout(timer);
  }
  throw new Error("unreachable");
}

/**
 * Automatically discovers whether FastAPI is running on the current origin or on port 8000 / 8001
 * Probes candidates in parallel for sub-second zero-wait connection.
 */
async function resolveBackendURL() {
  // 1. If loaded from the same server (deployment or unified FastAPI server)
  if (
    window.location.protocol.startsWith("http") &&
    window.location.port !== "5500" &&
    window.location.port !== "3000"
  ) {
    try {
      const candidate = await checkHealth(window.location.origin);
      API_BASE_URL = candidate;
      return API_BASE_URL;
    } catch (e) {
      // Continue to check local dev ports
    }
  }

  // 2. Probe candidate endpoints in parallel
  const hostnames = ["127.0.0.1", "localhost"];
  const ports = [8000, 8001, 8080];
  const candidates = [];
  for (const h of hostnames) {
    for (const p of ports) {
      candidates.push(`http://${h}:${p}`);
    }
  }

  try {
    const reachable = await Promise.any(candidates.map((c) => checkHealth(c)));
    console.log(`[FastAPI Auto-Detect] Connected to backend at ${reachable}`);
    API_BASE_URL = reachable;
    return API_BASE_URL;
  } catch (e) {
    // Retain previous or default URL
    return API_BASE_URL;
  }
}

/** In-memory cache of students fetched from SQLite */
let students = [];

/** Tracks if a student record is currently being edited (null = Add Mode) */
let editingStudentId = null;

// ==========================================================================
// 2. DOM ELEMENTS
// ==========================================================================

// Form Elements
const studentForm = document.getElementById("studentForm");
const submitBtn = document.getElementById("submitBtn");
const submitBtnText = document.getElementById("submitBtnText");
const resetBtn = document.getElementById("resetBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

// Form Inputs
const inputName = document.getElementById("studentName");
const inputRoll = document.getElementById("rollNumber");
const selectDept = document.getElementById("department");
const selectSem = document.getElementById("semester");
const inputMath = document.getElementById("mathMarks");
const inputPhysics = document.getElementById("physicsMarks");
const inputCS = document.getElementById("csMarks");
const inputEnglish = document.getElementById("englishMarks");
const inputChem = document.getElementById("chemMarks");

// Table & Toolbar Elements
const studentTableBody = document.getElementById("studentTableBody");
const emptyState = document.getElementById("emptyState");
const tableRecordCount = document.getElementById("tableRecordCount");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const statusFilter = document.getElementById("statusFilter");

// Dashboard Summary KPI Elements
const totalStudentsEl = document.getElementById("totalStudents");
const averagePercentageEl = document.getElementById("averagePercentage");
const passedStudentsEl = document.getElementById("passedStudents");
const passedRateEl = document.getElementById("passedRate");
const failedStudentsEl = document.getElementById("failedStudents");
const failedRateEl = document.getElementById("failedRate");

// Mobile Drawer Elements
const menuToggleBtn = document.getElementById("menuToggleBtn");
const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const navLinks = document.querySelectorAll(".nav-link");

// Toast Notification Container
const toastContainer = document.getElementById("toastContainer");

// ==========================================================================
// 3. SAFE HTTP REQUEST WRAPPER WITH TIMEOUT & JSON HANDLING
// ==========================================================================

/**
 * Robust fetch wrapper:
 * - Implements an 8-second timeout using AbortController (prevents infinite hanging)
 * - Safely handles non-JSON / plain text / HTML error responses
 * - Returns structured { ok, status, data }
 */
async function apiRequest(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timer);

    let data = null;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { detail: text || `HTTP ${response.status} response` };
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    clearTimeout(timer);
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Please check if the FastAPI backend is running at " + API_BASE_URL);
    }
    throw error;
  }
}

// ==========================================================================
// 4. API COMMUNICATION (FETCH API)
// ==========================================================================

/**
 * Loads all student records from SQLite via GET /students
 */
async function fetchStudents() {
  try {
    await resolveBackendURL();
    const { ok, status, data } = await apiRequest(`${API_BASE_URL}/students`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!ok) {
      throw new Error(data?.detail || `HTTP ${status} error`);
    }

    students = Array.isArray(data) ? data : [];
    applySearchAndFilter();
    updateDashboardStatistics();
  } catch (error) {
    console.error("Error communicating with backend API:", error);
    showBackendOfflineState(error.message);
  }
}

/**
 * Registers a new student in SQLite via POST /students
 * @param {Object} studentPayload
 */
async function createStudentAPI(studentPayload) {
  setButtonLoading(true, "Saving...");
  try {
    const { ok, status, data } = await apiRequest(`${API_BASE_URL}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(studentPayload)
    });

    if (!ok) {
      if (status === 400 && data?.detail) {
        setFieldError("rollNumber", "rollError", data.detail);
        showToast(data.detail, "danger");
      } else if (status === 422) {
        showToast("Invalid data format submitted.", "danger");
      } else {
        showToast(data?.detail || `Error: Failed to save record (HTTP ${status})`, "danger");
      }
      return false;
    }

    // Success
    showToast(`Student "${data.name}" added to database!`, "success");
    resetStudentForm();
    await fetchStudents();
    return true;
  } catch (error) {
    console.error("POST /students failed:", error);
    showToast(error.message || "Backend connection failed. Please ensure FastAPI is running.", "danger");
    return false;
  } finally {
    // Guarantees button returns to normal state in all scenarios
    setButtonLoading(false, "Save Student Record");
  }
}

/**
 * Updates an existing student in SQLite via PUT /students/{id}
 * @param {number|string} studentId
 * @param {Object} studentPayload
 */
async function updateStudentAPI(studentId, studentPayload) {
  setButtonLoading(true, "Updating...");
  try {
    const { ok, status, data } = await apiRequest(`${API_BASE_URL}/students/${studentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(studentPayload)
    });

    if (!ok) {
      if (status === 400 && data?.detail) {
        setFieldError("rollNumber", "rollError", data.detail);
        showToast(data.detail, "danger");
      } else {
        showToast(data?.detail || "Failed to update student.", "danger");
      }
      return false;
    }

    // Success
    showToast(`Record for "${data.name}" updated successfully!`, "success");
    cancelEditMode();
    await fetchStudents();
    return true;
  } catch (error) {
    console.error(`PUT /students/${studentId} failed:`, error);
    showToast(error.message || "Backend connection failed. Please ensure FastAPI is running.", "danger");
    return false;
  } finally {
    setButtonLoading(false, editingStudentId ? "Update Student Record" : "Save Student Record");
  }
}

/**
 * Deletes a student from SQLite via DELETE /students/{id}
 * @param {number|string} studentId
 * @param {string} studentName
 */
async function deleteStudentAPI(studentId, studentName) {
  try {
    const { ok, data } = await apiRequest(`${API_BASE_URL}/students/${studentId}`, {
      method: "DELETE",
      headers: { "Accept": "application/json" }
    });

    if (!ok) {
      throw new Error(data?.detail || "Failed to delete student");
    }

    showToast(`Record for "${studentName}" deleted from database.`, "info");

    if (editingStudentId && String(editingStudentId) === String(studentId)) {
      cancelEditMode();
    }

    await fetchStudents();
  } catch (error) {
    console.error(`DELETE /students/${studentId} failed:`, error);
    showToast(error.message || "Error deleting record from server.", "danger");
  }
}

// ==========================================================================
// 5. UI RENDERING & STATUS COMPUTATION
// ==========================================================================

/**
 * Formats display status badge (supports Distinction when >= 75%)
 */
function getDisplayStatus(student) {
  if (student.status === "Failed") {
    return "Failed";
  }
  if (student.percentage >= 75.0) {
    return "Distinction";
  }
  return "Passed";
}

/**
 * Renders students array into the HTML table
 * @param {Array} studentList
 */
function renderStudentTable(studentList = students) {
  studentTableBody.innerHTML = "";

  if (studentList.length === 0) {
    emptyState.style.display = "block";
    tableRecordCount.textContent = "0 Records";
    return;
  }

  emptyState.style.display = "none";
  tableRecordCount.textContent = `${studentList.length} ${studentList.length === 1 ? "Record" : "Records"}`;

  studentList.forEach((student) => {
    const displayStatus = getDisplayStatus(student);
    const gradeClass = getGradeBadgeClass(student.grade);
    const statusClass = getStatusBadgeClass(displayStatus);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <span class="cell-student-name">${escapeHTML(student.name)}</span>
      </td>
      <td>
        <span class="cell-roll">${escapeHTML(student.roll_number)}</span>
      </td>
      <td>
        <span>${escapeHTML(student.department)}</span>
        <span class="cell-subtext">${escapeHTML(student.semester)}</span>
      </td>
      <td>
        <strong>${student.total_marks}</strong> <span class="cell-subtext">/ 500</span>
      </td>
      <td>
        <strong>${student.percentage}%</strong>
      </td>
      <td>
        <span class="badge badge-grade ${gradeClass}">${escapeHTML(student.grade)}</span>
      </td>
      <td>
        <span class="badge ${statusClass}">
          ${displayStatus === "Distinction" ? "&#9733; " : ""}${displayStatus}
        </span>
      </td>
      <td class="text-center">
        <div class="table-actions">
          <button
            type="button"
            class="btn-action-edit"
            data-id="${escapeHTML(String(student.id))}"
            title="Edit student record"
            aria-label="Edit ${escapeHTML(student.name)}"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button
            type="button"
            class="btn-action-delete"
            data-id="${escapeHTML(String(student.id))}"
            title="Delete student record"
            aria-label="Delete ${escapeHTML(student.name)}"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            Delete
          </button>
        </div>
      </td>
    `;
    studentTableBody.appendChild(tr);
  });
}

function getGradeBadgeClass(grade) {
  switch (grade) {
    case "A": return "badge-grade-a";
    case "B": return "badge-grade-b";
    case "C": return "badge-grade-c";
    case "D": return "badge-grade-d";
    default:  return "badge-grade-f";
  }
}

function getStatusBadgeClass(status) {
  if (status === "Distinction") return "badge-distinction";
  if (status === "Passed") return "badge-pass";
  return "badge-fail";
}

function updateDashboardStatistics() {
  const total = students.length;

  if (total === 0) {
    totalStudentsEl.textContent = "0";
    averagePercentageEl.textContent = "0.0%";
    passedStudentsEl.textContent = "0";
    passedRateEl.textContent = "0% Pass Rate";
    failedStudentsEl.textContent = "0";
    failedRateEl.textContent = "0 Failed";
    return;
  }

  let totalPercentageSum = 0;
  let passedCount = 0;
  let failedCount = 0;

  students.forEach((student) => {
    totalPercentageSum += student.percentage;
    if (student.status === "Failed") {
      failedCount++;
    } else {
      passedCount++;
    }
  });

  const avgPercentage = (totalPercentageSum / total).toFixed(1);
  const passRate = Math.round((passedCount / total) * 100);
  const failRate = Math.round((failedCount / total) * 100);

  totalStudentsEl.textContent = total;
  averagePercentageEl.textContent = `${avgPercentage}%`;
  passedStudentsEl.textContent = passedCount;
  passedRateEl.textContent = `${passRate}% Pass Rate`;
  failedStudentsEl.textContent = failedCount;
  failedRateEl.textContent = failedCount === 1 ? "1 Student Failed" : `${failRate}% Fail Rate (${failedCount})`;
}

function showBackendOfflineState(reason = "") {
  emptyState.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <h3 style="color: #991b1b; margin-top: 10px;">FastAPI Backend is Offline</h3>
    <p>Could not connect to <code>${escapeHTML(API_BASE_URL)}/students</code>.</p>
    ${reason ? `<p style="font-size: 0.8rem; color: #dc2626; margin-top: 4px;">Detail: ${escapeHTML(reason)}</p>` : ""}
    <div style="margin-top: 14px;">
      <button type="button" id="btnRetryOffline" class="btn btn-primary" style="padding: 8px 18px; font-size: 0.85rem;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Retry Connection
      </button>
    </div>
    <p style="margin-top: 14px; font-size: 0.85rem; color: #475569;">
      Or run in terminal: <code>python run.py</code>
    </p>
  `;
  emptyState.style.display = "block";
  tableRecordCount.textContent = "Offline";

  const btnRetry = document.getElementById("btnRetryOffline");
  if (btnRetry) {
    btnRetry.addEventListener("click", () => {
      btnRetry.textContent = "Checking...";
      btnRetry.disabled = true;
      fetchStudents();
    });
  }

  showToast("Cannot reach FastAPI backend. Please ensure the server is running.", "danger");
}

// ==========================================================================
// 6. FORM VALIDATION & SUBMISSION
// ==========================================================================

function clearValidationErrors() {
  document.querySelectorAll(".error-msg").forEach((el) => (el.textContent = ""));
  document.querySelectorAll(".error-input").forEach((el) => el.classList.remove("error-input"));
}

function setFieldError(inputId, errorId, message) {
  const inputEl = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (inputEl) inputEl.classList.add("error-input");
  if (errorEl) errorEl.textContent = message;
}

function setButtonLoading(isLoading, text) {
  if (submitBtn) {
    submitBtn.disabled = isLoading;
  }
  if (submitBtnText) {
    submitBtnText.textContent = text;
  }
}

function validateStudentForm() {
  clearValidationErrors();

  const name = inputName.value.trim();
  const rollNumber = inputRoll.value.trim();
  const department = selectDept.value;
  const semester = selectSem.value;

  const mathRaw = inputMath.value.trim();
  const physicsRaw = inputPhysics.value.trim();
  const csRaw = inputCS.value.trim();
  const englishRaw = inputEnglish.value.trim();
  const chemRaw = inputChem.value.trim();

  let isValid = true;

  if (!name || name.length < 2) {
    setFieldError("studentName", "nameError", "Student name must be at least 2 characters.");
    isValid = false;
  }

  if (!rollNumber) {
    setFieldError("rollNumber", "rollError", "Roll number is required.");
    isValid = false;
  }

  if (!department) {
    setFieldError("department", "deptError", "Please select a department.");
    isValid = false;
  }

  if (!semester) {
    setFieldError("semester", "semError", "Please select a semester.");
    isValid = false;
  }

  const subjects = [
    { inputId: "mathMarks", errId: "mathError", raw: mathRaw, label: "Mathematics" },
    { inputId: "physicsMarks", errId: "physicsError", raw: physicsRaw, label: "Physics" },
    { inputId: "csMarks", errId: "csError", raw: csRaw, label: "Computer Science" },
    { inputId: "englishMarks", errId: "englishError", raw: englishRaw, label: "English" },
    { inputId: "chemMarks", errId: "chemError", raw: chemRaw, label: "Chemistry" }
  ];

  const marks = {};

  subjects.forEach((sub) => {
    if (sub.raw === "") {
      setFieldError(sub.inputId, sub.errId, `${sub.label} marks required.`);
      isValid = false;
    } else {
      const val = Number(sub.raw);
      if (isNaN(val) || val < 0 || val > 100) {
        setFieldError(sub.inputId, sub.errId, "Marks must be between 0 and 100.");
        isValid = false;
      } else {
        marks[sub.inputId] = val;
      }
    }
  });

  if (!isValid) {
    showToast("Please correct the highlighted form errors.", "danger");
    return null;
  }

  return {
    name,
    roll_number: rollNumber,
    department,
    semester,
    mathematics: marks.mathMarks,
    physics: marks.physicsMarks,
    computer_science: marks.csMarks,
    english: marks.englishMarks,
    chemistry: marks.chemMarks
  };
}

studentForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = validateStudentForm();
  if (!payload) return;

  if (editingStudentId) {
    await updateStudentAPI(editingStudentId, payload);
  } else {
    await createStudentAPI(payload);
  }
});

function resetStudentForm() {
  studentForm.reset();
  clearValidationErrors();
}

resetBtn.addEventListener("click", () => {
  if (editingStudentId) {
    cancelEditMode();
  } else {
    clearValidationErrors();
  }
});

// ==========================================================================
// 7. EDIT STUDENT WORKFLOW
// ==========================================================================

function startEditStudent(studentId) {
  const target = students.find((s) => String(s.id) === String(studentId));
  if (!target) return;

  editingStudentId = studentId;

  inputName.value = target.name;
  inputRoll.value = target.roll_number;
  selectDept.value = target.department;
  selectSem.value = target.semester;

  inputMath.value = target.mathematics;
  inputPhysics.value = target.physics;
  inputCS.value = target.computer_science;
  inputEnglish.value = target.english;
  inputChem.value = target.chemistry;

  clearValidationErrors();

  submitBtnText.textContent = "Update Student Record";
  cancelEditBtn.style.display = "inline-flex";

  const addStudentSection = document.getElementById("addStudentSection");
  if (addStudentSection) {
    addStudentSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  inputName.focus();
  showToast(`Editing details for ${target.name}`, "info");
}

function cancelEditMode() {
  editingStudentId = null;
  resetStudentForm();
  submitBtnText.textContent = "Save Student Record";
  cancelEditBtn.style.display = "none";
}

cancelEditBtn.addEventListener("click", cancelEditMode);

// ==========================================================================
// 8. DELETE STUDENT WORKFLOW
// ==========================================================================

studentTableBody.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".btn-action-edit");
  const deleteBtn = e.target.closest(".btn-action-delete");

  if (editBtn) {
    const studentId = editBtn.getAttribute("data-id");
    startEditStudent(studentId);
  } else if (deleteBtn) {
    const studentId = deleteBtn.getAttribute("data-id");
    const target = students.find((s) => String(s.id) === String(studentId));
    if (!target) return;

    const confirmed = confirm(
      `Are you sure you want to delete this record?\n\nStudent: ${target.name}\nRoll No: ${target.roll_number}`
    );

    if (confirmed) {
      deleteStudentAPI(studentId, target.name);
    }
  }
});

// ==========================================================================
// 9. SEARCH & FILTER LOGIC
// ==========================================================================

function applySearchAndFilter() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  clearSearchBtn.style.display = query ? "block" : "none";

  const filtered = students.filter((student) => {
    const matchesName = student.name.toLowerCase().includes(query);
    const matchesRoll = student.roll_number.toLowerCase().includes(query);
    const matchesQuery = matchesName || matchesRoll;

    if (!matchesQuery) return false;

    if (selectedStatus === "all") return true;

    const displayStatus = getDisplayStatus(student);

    if (selectedStatus === "Distinction") {
      return displayStatus === "Distinction";
    }
    if (selectedStatus === "Passed") {
      return displayStatus === "Passed" || displayStatus === "Distinction";
    }
    if (selectedStatus === "Failed") {
      return displayStatus === "Failed";
    }

    return true;
  });

  renderStudentTable(filtered);
}

searchInput.addEventListener("input", applySearchAndFilter);

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  clearSearchBtn.style.display = "none";
  searchInput.focus();
  applySearchAndFilter();
});

statusFilter.addEventListener("change", applySearchAndFilter);

// ==========================================================================
// 10. TOAST NOTIFICATIONS & SANITIZATION
// ==========================================================================

function showToast(message, type = "info") {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let iconSVG = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`;

  if (type === "success") {
    iconSVG = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>`;
  } else if (type === "danger") {
    iconSVG = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>`;
  }

  toast.innerHTML = `
    ${iconSVG}
    <span>${escapeHTML(message)}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================================================
// 11. SIDEBAR NAVIGATION & MOBILE DRAWER
// ==========================================================================

if (menuToggleBtn && sidebar && sidebarOverlay && sidebarCloseBtn) {
  function openMobileSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("active");
  }

  function closeMobileSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
  }

  menuToggleBtn.addEventListener("click", openMobileSidebar);
  sidebarCloseBtn.addEventListener("click", closeMobileSidebar);
  sidebarOverlay.addEventListener("click", closeMobileSidebar);
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((item) => item.classList.remove("active"));
    link.classList.add("active");

    const targetView = link.getAttribute("data-view");
    if (targetView === "students" || targetView === "reports") {
      const recordsSection = document.getElementById("recordsSection");
      if (recordsSection) recordsSection.scrollIntoView({ behavior: "smooth" });
    } else if (targetView === "dashboard") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (targetView === "performance") {
      const metricsGrid = document.querySelector(".metrics-grid");
      if (metricsGrid) metricsGrid.scrollIntoView({ behavior: "smooth" });
    }

    if (window.innerWidth <= 860 && sidebar) {
      sidebar.classList.remove("open");
      sidebarOverlay.classList.remove("active");
    }
  });
});

// ==========================================================================
// 12. ROBUST APPLICATION INITIALIZATION
// ==========================================================================

// If the DOM is still loading, wait for DOMContentLoaded.
// If already loaded/interactive, invoke fetchStudents() immediately.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", fetchStudents);
} else {
  fetchStudents();
}
