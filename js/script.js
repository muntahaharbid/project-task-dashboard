"use strict";

// المفتاحان يحفظان بيانات التطبيق واختيار الوضع الداكن بشكل مستقل.
const STORAGE_KEY = "taskflow-data-v2";
const LEGACY_STORAGE_KEY = "taskflow-data";
const THEME_KEY = "taskflow-theme";
const STATUS = { pending: "قيد الانتظار", "in-progress": "قيد التنفيذ", completed: "مكتملة" };
const PRIORITY = { low: "منخفضة", medium: "متوسطة", high: "عالية" };
const today = new Date();
const dateString = date => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0")
].join("-");
const daysFromNow = amount => {
  const date = new Date();
  date.setDate(date.getDate() + amount);
  return dateString(date);
};

const sampleData = {
  projects: [
    {
      id: 1,
      name: "تطوير الموقع الإلكتروني",
      description: "تصميم وتطوير موقع الشركة الإلكتروني.",
      createdAt: dateString(today)
    },
    {
      id: 2,
      name: "حملة التسويق الرقمي",
      description: "إعداد محتوى الحملة ومتابعة نتائجها.",
      createdAt: dateString(today)
    },
    {
      id: 3,
      name: "تحسين تجربة العملاء",
      description: "جمع الملاحظات وتحويلها إلى تحسينات عملية.",
      createdAt: dateString(today)
    }
  ],
  tasks: [
    {
      id: 101, title: "تصميم الصفحة الرئيسية", projectId: 1,
      status: "completed", priority: "high", dueDate: daysFromNow(-2)
    },
    {
      id: 102, title: "مراجعة صفحة الخدمات", projectId: 1,
      status: "in-progress", priority: "medium", dueDate: daysFromNow(2)
    },
    {
      id: 103, title: "كتابة المحتوى التعريفي", projectId: 1,
      status: "pending", priority: "high", dueDate: daysFromNow(5)
    },
    {
      id: 104, title: "تجهيز منشورات الأسبوع", projectId: 2,
      status: "in-progress", priority: "medium", dueDate: daysFromNow(-1)
    },
    {
      id: 105, title: "مراجعة نتائج الاستبيان", projectId: 3,
      status: "pending", priority: "low", dueDate: daysFromNow(8)
    }
  ]
};

// تحميل البيانات المحفوظة أو استخدام بيانات تجريبية عند أول تشغيل.
function loadData() {
  try {
    // نقرأ المفتاح السابق أيضًا حتى لا نفقد بيانات النسخة الأولية عند التحديث.
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return structuredClone(sampleData);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.projects) && Array.isArray(parsed.tasks)) return parsed;
    throw new Error("تنسيق البيانات المحفوظة غير صحيح");
  } catch (error) {
    console.error("تعذر قراءة البيانات المحفوظة:", error);
    return structuredClone(sampleData);
  }
}

let data = loadData();
let toastTimer;
let chart = null;
let draggedTaskId = null;
const $ = id => document.getElementById(id);

// حفظ الحالة الحالية للتطبيق كنص JSON داخل تخزين المتصفح.
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("تعذر حفظ البيانات:", error);
    showToast("تعذر الحفظ. تحققي من مساحة التخزين في المتصفح.", true);
    return false;
  }
}

function showToast(message, isError = false) {
  const toast = $("toast");
  toast.textContent = message;
  toast.style.background = isError ? "#a83e43" : "";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// دوال مساعدة لتنسيق النصوص وربط المهمة بالمشروع وحساب التأخير.
// نهرب النص قبل عرضه حتى لا يتحول نص المستخدم إلى HTML.
function escapeHTML(value) {
  const htmlEntities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return String(value ?? "").replace(/[&<>"']/g, character => htmlEntities[character]);
}
const projectName = id => data.projects.find(project => project.id === id)?.name || "مشروع غير موجود";
const overdue = task => task.status !== "completed" && task.dueDate && task.dueDate < dateString(new Date());
const newId = () => Date.now() + Math.floor(Math.random() * 1000);

// تحديث الأرقام ونسبة الإنجاز المعروضة في لوحة التحكم.
function renderDashboard() {
  const total = data.tasks.length;
  const completed = data.tasks.filter(task => task.status === "completed").length;
  const percent = total ? Math.round(completed / total * 100) : 0;
  $("totalProjects").textContent = data.projects.length;
  $("totalTasks").textContent = total;
  $("completedTasks").textContent = completed;
  $("overdueTasks").textContent = data.tasks.filter(overdue).length;
  $("completionRate").textContent = `${percent}%`;
  $("completionCount").textContent = `${completed} من ${total} مهام`;
  $("completionBar").style.width = `${percent}%`;
  $("completionBar").setAttribute("aria-valuenow", percent);
}

// إنشاء بطاقات المشاريع وحساب تقدم كل مشروع من مهامه.
function renderProjects() {
  const host = $("projectsList");
  const projectFilter = $("projectFilter");
  const selectedProjectId = projectFilter.value;
  projectFilter.innerHTML = '<option value="">كل المشاريع</option>' + data.projects.map(project =>
    `<option value="${project.id}">${escapeHTML(project.name)}</option>`
  ).join("");
  if (data.projects.some(project => String(project.id) === selectedProjectId)) {
    projectFilter.value = selectedProjectId;
  }

  if (!data.projects.length) {
    host.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <strong>لا توجد مشاريع حتى الآن</strong>
        أنشئي مشروعًا لتبدئي بتنظيم المهام.<br>
        <button class="btn btn-primary btn-sm" type="button" data-open-project>
          إضافة أول مشروع
        </button>
      </div>`;
    return;
  }
  host.innerHTML = data.projects.map(project => {
    const tasks = data.tasks.filter(task => task.projectId === project.id);
    const done = tasks.filter(task => task.status === "completed").length;
    const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    return `
      <article class="project-card">
        <h3>${escapeHTML(project.name)}</h3>
        <p>${escapeHTML(project.description || "لا يوجد وصف لهذا المشروع.")}</p>
        <div class="project-meta">
          <span>${tasks.length} مهام</span>
          <span>${progress}% مكتمل</span>
        </div>
        <div class="project-progress" aria-label="إنجاز المشروع ${progress}%">
          <span style="width:${progress}%"></span>
        </div>
        <div class="project-actions">
          <button class="btn btn-outline-primary btn-sm" type="button"
            data-action="view-project-tasks" data-id="${project.id}">عرض المهام</button>
          <button class="btn btn-outline-primary btn-sm" type="button"
            data-action="edit-project" data-id="${project.id}">تعديل</button>
          <button class="btn btn-outline-danger btn-sm" type="button"
            data-action="delete-project" data-id="${project.id}">حذف</button>
        </div>
      </article>`;
  }).join("");
}

// تطبيق البحث والتصفية والفرز، ثم إنشاء بطاقات المهام.
function renderTasks() {
  const text = $("searchInput").value.trim().toLocaleLowerCase("ar");
  const projectId = $("projectFilter").value;
  const status = $("statusFilter").value;
  const priority = $("priorityFilter").value;
  const sort = $("sortFilter").value;
  const tasks = data.tasks.filter(task => {
    const taskTitle = task.title.toLocaleLowerCase("ar");
    const taskProject = projectName(task.projectId).toLocaleLowerCase("ar");
    const matchesText = taskTitle.includes(text) || taskProject.includes(text);
    const matchesProject = !projectId || String(task.projectId) === projectId;
    return matchesText && matchesProject
      && (!status || task.status === status)
      && (!priority || task.priority === priority);
  });
  tasks.sort((a, b) => {
    if (sort === "progress") {
      return (b.status === "completed") - (a.status === "completed")
        || a.title.localeCompare(b.title, "ar");
    }
    if (sort === "priority") {
      const priorityRank = { high: 0, medium: 1, low: 2 };
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    if (!a.dueDate || !b.dueDate) return a.dueDate ? -1 : b.dueDate ? 1 : 0;
    return sort === "date-desc" ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate);
  });
  $("taskCount").textContent = `عرض ${tasks.length} من ${data.tasks.length} مهام`;
  const host = $("tasksList");
  if (!tasks.length) {
    const noTasksAtAll = data.tasks.length === 0;
    const projectHasNoTasks = projectId
      && !data.tasks.some(task => String(task.projectId) === projectId);
    const showAddTask = noTasksAtAll || projectHasNoTasks;
    const emptyMessage = showAddTask
      ? "أضيفي مهمة جديدة لتبدئي."
      : "جربي تغيير كلمات البحث أو خيارات التصفية.";
    const emptyTitle = noTasksAtAll
      ? "لا توجد مهام بعد"
      : projectHasNoTasks
        ? "لا توجد مهام لهذا المشروع بعد"
        : "لا توجد نتائج مطابقة";
    const addTaskButton = showAddTask
      ? '<br><button class="btn btn-primary btn-sm" type="button" data-open-task>إضافة أول مهمة</button>'
      : "";
    host.innerHTML = `
      <div class="empty-state">
        <strong>${emptyTitle}</strong>
        ${emptyMessage}
        ${addTaskButton}
      </div>`;
    return;
  }
  host.innerHTML = tasks.map(task => `
    <article class="task-card" draggable="true" data-task-card data-id="${task.id}"
      aria-label="اسحبي لتغيير حالة ${escapeHTML(task.title)}">
      <div class="task-main">
        <h3 class="task-title">${escapeHTML(task.title)}</h3>
        <span class="task-project">${escapeHTML(projectName(task.projectId))}</span>
      </div>
      <div class="task-status">
        <span class="task-label">الحالة</span>
        <span class="status-badge status-${escapeHTML(task.status)}">
          ${STATUS[task.status] || "غير محددة"}
        </span>
      </div>
      <div class="task-priority">
        <span class="task-label">الأولوية</span>
        <span class="priority-badge priority-${escapeHTML(task.priority)}">
          ${PRIORITY[task.priority] || "غير محددة"}
        </span>
      </div>
      <div class="task-date">
        <span class="task-label">الاستحقاق</span>
        <span>${escapeHTML(task.dueDate || "غير محدد")}${overdue(task) ? " · متأخرة" : ""}</span>
      </div>
      <div class="task-actions">
        <select class="form-select status-select" data-action="change-status"
          data-id="${task.id}" aria-label="تغيير حالة: ${escapeHTML(task.title)}">
          ${Object.entries(STATUS).map(([key, label]) =>
            `<option value="${key}" ${task.status === key ? "selected" : ""}>${label}</option>`
          ).join("")}
        </select>
        <button class="btn btn-light btn-sm" type="button" data-action="edit-task"
          data-id="${task.id}" aria-label="تعديل ${escapeHTML(task.title)}">تعديل</button>
        <button class="btn btn-outline-danger btn-sm" type="button" data-action="delete-task"
          data-id="${task.id}" aria-label="حذف ${escapeHTML(task.title)}">حذف</button>
      </div>
    </article>`).join("");
}

// حساب المهام في كل حالة وتحديث مخطط Chart.js.
function renderChart() {
  const counts = ["pending", "in-progress", "completed"].map(status =>
    data.tasks.filter(task => task.status === status).length
  );
  if (typeof Chart === "undefined") {
    $("chartFallback").hidden = false;
    $("chartFallback").innerHTML = `
      <span>● انتظار: ${counts[0]}</span>
      <span>● تنفيذ: ${counts[1]}</span>
      <span>● مكتمل: ${counts[2]}</span>`;
    return;
  }
  $("chartFallback").hidden = true;
  if (!chart) {
    chart = new Chart($("taskStatusChart"), {
      type: "doughnut",
      data: {
        labels: Object.values(STATUS),
        datasets: [{
          data: counts,
          backgroundColor: ["#f2bf55", "#7668e5", "#43b884"],
          borderWidth: 0,
          hoverOffset: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: {
            position: "bottom",
            rtl: true,
            labels: {
              color: document.body.classList.contains("dark") ? "#e6e8f2" : "#858a9d",
              usePointStyle: true,
              boxWidth: 7,
              padding: 15,
              font: { family: "IBM Plex Sans Arabic" }
            }
          }
        }
      }
    });
  }
  else {
    chart.data.datasets[0].data = counts;
    chart.update();
  }
}

// نقطة تحديث واحدة تستدعي دوال عرض أقسام الصفحة.
function renderApp() {
  renderDashboard();
  renderProjects();
  renderTasks();
  renderChart();
}

// فتح نموذج المشروع؛ وجود مشروع يعني تعبئته للتعديل.
function openProject(project = null) {
  $("projectForm").reset(); $("projectError").textContent = "";
  $("projectId").value = project?.id ?? "";
  $("projectName").value = project?.name ?? "";
  $("projectDescription").value = project?.description ?? "";
  $("projectDialogTitle").textContent = project ? "تعديل المشروع" : "إضافة مشروع";
  $("projectDialog").showModal(); $("projectName").focus();
}

// فتح نموذج المهمة وتجهيز قائمة المشاريع للاختيار.
function openTask(task = null) {
  if (!task && !data.projects.length) {
    showToast("أضيفي مشروعًا أولًا قبل إنشاء مهمة.", true);
    openProject();
    return;
  }
  $("taskForm").reset(); $("taskError").textContent = "";
  $("taskId").value = task?.id ?? "";
  $("taskTitle").value = task?.title ?? "";
  $("taskProject").innerHTML = data.projects.map(project =>
    `<option value="${project.id}">${escapeHTML(project.name)}</option>`
  ).join("");
  $("taskProject").value = task?.projectId
    ?? ($("projectFilter").value || data.projects[0]?.id)
    ?? "";
  $("taskStatus").value = task?.status ?? "pending";
  $("taskPriority").value = task?.priority ?? "medium";
  $("taskDueDate").value = task?.dueDate ?? "";
  $("taskDialogTitle").textContent = task ? "تعديل المهمة" : "إضافة مهمة";
  $("taskDialog").showModal(); $("taskTitle").focus();
}

// تحويل المعرّف القادم من الزر إلى رقم ثم إيجاد العنصر المناسب.
function findById(list, id) { return list.find(item => item.id === Number(id)); }

// التحقق من نموذج المشروع ثم الإضافة أو التعديل والحفظ.
$("projectForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = Number($("projectId").value);
  const name = $("projectName").value.trim();
  const description = $("projectDescription").value.trim();
  if (!name || name.length > 100) {
    $("projectError").textContent = "اكتبي اسمًا من حرف إلى 100 حرف.";
    $("projectName").focus();
    return;
  }
  const existing = findById(data.projects, id);
  if (existing) { existing.name = name; existing.description = description; }
  else data.projects.push({ id: newId(), name, description, createdAt: dateString(new Date()) });
  if (saveData()) {
    $("projectDialog").close();
    renderApp();
    showToast(existing ? "تم تعديل المشروع." : "تمت إضافة المشروع.");
  }
});

// التحقق من نموذج المهمة وحفظ حقولها في بيانات التطبيق.
$("taskForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = Number($("taskId").value);
  const title = $("taskTitle").value.trim();
  const projectId = Number($("taskProject").value);
  const dueDate = $("taskDueDate").value;
  if (!title || title.length > 150) {
    $("taskError").textContent = "اكتبي اسمًا للمهمة من حرف إلى 150 حرفًا.";
    $("taskTitle").focus();
    return;
  }
  if (!data.projects.some(project => project.id === projectId)) {
    $("taskError").textContent = "اختاري مشروعًا صالحًا.";
    return;
  }
  const taskData = {
    title,
    projectId,
    status: $("taskStatus").value,
    priority: $("taskPriority").value,
    dueDate
  };
  const existing = findById(data.tasks, id);
  if (existing) Object.assign(existing, taskData);
  else data.tasks.push({ id: newId(), ...taskData });
  if (saveData()) {
    $("taskDialog").close();
    renderApp();
    showToast(existing ? "تم تعديل المهمة." : "تمت إضافة المهمة.");
  }
});

// مستمع واحد يتعرف على زر الإضافة أو التعديل أو الحذف الذي تم ضغطه.
document.addEventListener("click", event => {
  const openButton = event.target.closest("[data-open-task], [data-open-project]");
  if (openButton) { openButton.hasAttribute("data-open-task") ? openTask() : openProject(); return; }
  if (event.target.closest("[data-close-dialog]")) { event.target.closest("dialog").close(); return; }
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "view-project-tasks") {
    const project = findById(data.projects, id);
    if (!project) return;
    $("projectFilter").value = String(project.id);
    $("searchInput").value = "";
    $("statusFilter").value = "";
    $("priorityFilter").value = "";
    renderTasks();
    $("tasks").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "edit-project") openProject(findById(data.projects, id));
  if (action === "edit-task") openTask(findById(data.tasks, id));
  if (action === "delete-task") {
    const task = findById(data.tasks, id);
    if (task && confirm(`هل تريدين حذف المهمة «${task.title}»؟`)) {
      data.tasks = data.tasks.filter(item => item.id !== task.id);
      if (saveData()) {
        renderApp();
        showToast("تم حذف المهمة.");
      }
    }
  }
  if (action === "delete-project") {
    const project = findById(data.projects, id);
    if (!project) return;
    const linked = data.tasks.filter(task => task.projectId === project.id).length;
    const message = linked
      ? `سيُحذف المشروع «${project.name}» والمهام المرتبطة به (${linked}). هل تتابعين؟`
      : `هل تريدين حذف المشروع «${project.name}»؟`;
    if (confirm(message)) {
      data.projects = data.projects.filter(item => item.id !== project.id);
      data.tasks = data.tasks.filter(task => task.projectId !== project.id);
      if (saveData()) {
        renderApp();
        showToast("تم حذف المشروع.");
      }
    }
  }
});

// تغيير الحالة بقائمة الاختيار؛ تعمل باللمس ولوحة المفاتيح.
document.addEventListener("change", event => {
  const select = event.target.closest('select[data-action="change-status"]');
  if (!select) return;
  const task = findById(data.tasks, select.dataset.id);
  if (task) {
    task.status = select.value;
    if (saveData()) {
      renderApp();
      showToast("تم تحديث حالة المهمة.");
    }
  }
});

// إعادة عرض القائمة فور الكتابة أو عند تغيير خيار التصفية والفرز.
$("searchInput").addEventListener("input", renderTasks);
[$("projectFilter"), $("statusFilter"), $("priorityFilter"), $("sortFilter")].forEach(control =>
  control.addEventListener("change", renderTasks)
);

// على الكمبيوتر: سحب البطاقة إلى الحالة المطلوبة. للهاتف استخدمي القائمة أعلاه.
document.addEventListener("dragstart", event => {
  const card = event.target.closest("[data-task-card]");
  if (!card) return;
  draggedTaskId = Number(card.dataset.id); card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});
document.addEventListener("dragend", event => {
  const card = event.target.closest("[data-task-card]");
  if (card) card.classList.remove("dragging");
});
document.addEventListener("dragover", event => {
  const lane = event.target.closest("[data-drop-status]");
  if (draggedTaskId && (lane || event.target.closest("[data-task-card]"))) {
    event.preventDefault();
    if (lane) lane.classList.add("drag-over");
  }
});
document.addEventListener("dragleave", event => {
  const lane = event.target.closest("[data-drop-status]");
  if (lane) lane.classList.remove("drag-over");
});
document.addEventListener("drop", event => {
  const lane = event.target.closest("[data-drop-status]");
  const destination = event.target.closest("[data-task-card]");
  const sameTask = destination && Number(destination.dataset.id) === draggedTaskId;
  if ((!lane && !destination) || !draggedTaskId || sameTask) return;
  event.preventDefault();
  const task = findById(data.tasks, draggedTaskId);
  const target = destination ? findById(data.tasks, destination.dataset.id) : null;
  const nextStatus = lane?.dataset.dropStatus || target?.status;
  if (task && nextStatus && task.status !== nextStatus) {
    task.status = nextStatus;
    if (saveData()) {
      renderApp();
      showToast(`نُقلت المهمة إلى ${STATUS[task.status]}.`);
    }
  }
  document.querySelectorAll(".drop-lane").forEach(item => item.classList.remove("drag-over"));
  draggedTaskId = null;
});

// تطبيق الوضع المختار وتذكره حتى الزيارة القادمة.
function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  $("themeToggle").setAttribute("aria-pressed", String(dark));
  $("themeLabel").textContent = dark ? "الوضع الفاتح" : "الوضع الداكن";
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch (error) {
    console.warn("تعذر حفظ اختيار المظهر:", error);
  }
  if (chart) {
    chart.options.plugins.legend.labels.color = dark ? "#e6e8f2" : "#858a9d";
    chart.update();
  }
}
try { applyTheme(localStorage.getItem(THEME_KEY) === "dark"); } catch { applyTheme(false); }
$("themeToggle").addEventListener("click", () => applyTheme(!document.body.classList.contains("dark")));

// طي القائمة الجانبية على الكمبيوتر وفتحها في شاشة الهاتف.
$("sidebarToggle").addEventListener("click", () => {
  document.body.classList.toggle("collapsed");
  const expanded = !document.body.classList.contains("collapsed");
  $("sidebarToggle").setAttribute("aria-expanded", String(expanded));
  $("sidebarToggle").setAttribute("aria-label", expanded ? "طي القائمة الجانبية" : "توسيع القائمة الجانبية");
});
$("mobileMenu").addEventListener("click", () => {
  const open = $("sidebar").classList.toggle("mobile-open");
  $("mobileMenu").setAttribute("aria-expanded", String(open));
});
$("sidebar").addEventListener("click", event => {
  if (event.target.closest(".nav-link")) {
    $("sidebar").classList.remove("mobile-open");
    $("mobileMenu").setAttribute("aria-expanded", "false");
  }
});
document.querySelectorAll(".side-nav .nav-link").forEach(link => link.addEventListener("click", () => {
  document.querySelectorAll(".side-nav .nav-link").forEach(item => item.classList.remove("active"));
  link.classList.add("active");
}));
document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
}));

// عرض المحتوى بعد تجهيز البيانات لتجنب ظهور أرقام غير محدثة.
requestAnimationFrame(() => {
  renderApp();
  $("loadingState").hidden = true;
  $("appContent").hidden = false;
});
