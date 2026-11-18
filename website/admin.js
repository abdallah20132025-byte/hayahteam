const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const labels = { overview: "نظرة عامة", applications: "طلبات التقديم", content: "النصوص الرئيسية", stories: "الإنجازات والأخبار", media: "الصور والشعار", links: "الروابط والتواصل" };
const textFields = [
  ["slogan", "عبارة الواجهة الرئيسية", "معاً .. نصنع الفرق", "النص الكبير الظاهر في الصفحة الرئيسية"],
  ["tag", "العبارة الثانوية", "حياة فريق .. لا تنتهي", "النص أسفل العبارة الرئيسية"],
  ["about_h", "عنوان قسم النبذة", "نبذة عن حياة"],
  ["about_b", "نبذة الفريق", "اكتب نبذة عن الفريق هنا.", "يمكن كتابة فقرة كاملة عن الفريق ورسالته"],
  ["s1n", "عدد الإنجازات", "+10"], ["s1l", "وصف الإنجازات", "إنجازات"],
  ["s2n", "عدد أعضاء الفريق", "+100"], ["s2l", "وصف الأعضاء", "أعضاء الفريق"],
  ["s3n", "عدد الصور", "+500"], ["s3l", "وصف الصور", "صورة وتوثيق"],
  ["ach_h", "عنوان الإنجازات", "إنجازات الأسرة"],
  ["gal_h", "عنوان معرض الصور", "معرض الصور"],
  ["join_h", "عنوان التقديم", "التقديم للفريق"],
  ["join_b", "النص التوضيحي للتقديم", "املأ البيانات وسنتواصل معك."],
  ["news_h", "عنوان الأخبار", "الأخبار"],
  ["devname", "اسم المطور الظاهر بالموقع", "اسم المطور"],
];
const statusOptions = ["جديد", "قيد المراجعة", "تم التواصل", "مرفوض"];
let site = null;
let applications = [];
let currentView = "overview";
let revision = 0;
let savedRevision = 0;
let saveTimer = null;
let saving = false;
let toastTimer = null;

function setConnection(state, text) {
  const el = $(".connection");
  el.classList.remove("online", "offline");
  if (state) el.classList.add(state);
  $("#connectionText").textContent = text;
}

function setSaveStatus(text, kind = "") {
  const el = $("#saveStatus");
  el.textContent = text;
  el.classList.remove("ok", "error");
  if (kind) el.classList.add(kind);
}

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3600);
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    const error = new Error(data.error || `http_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function explainError(error) {
  const messages = {
    admin_secrets_not_configured: "لم تُضَف أسرار الإدارة إلى إعدادات Cloudflare Pages بعد.",
    http_404: "لم تُنشر وظائف لوحة الإدارة بعد. استخدم خطوات Cloudflare Pages وWrangler في دليل الإعداد.",
    database_not_configured: "قاعدة البيانات غير مربوطة بالمشروع؛ راجع إعداد D1 في دليل الإعداد.",
    site_state_unavailable: "تعذّر قراءة إعدادات الموقع. تحقق من تطبيق migration على قاعدة D1.",
    applications_unavailable: "تعذّر تحميل الطلبات. تحقق من قاعدة D1 وحاول مرة أخرى.",
    application_save_failed: "تعذّر حفظ الطلب في قاعدة البيانات. لم يتم تأكيد استلامه؛ أعد المحاولة.",
    site_save_failed: "لم تُحفظ التغييرات في قاعدة البيانات. تحقق من اتصال D1.",
    site_too_large: "حجم صور ومحتوى الموقع أكبر من حد الحفظ (1.8 ميغابايت). قلّل الصور أو أحجامها.",
    invalid_site_data: "بعض القيم غير صحيحة. تحقق من روابط فيسبوك وتيك توك أو حقول الصور.",
    invalid_password: "كلمة المرور غير صحيحة.",
    invalid_application: "بيانات الطلب غير مكتملة أو رقم الجوال غير صحيح.",
    unauthorized: "انتهت جلسة الدخول؛ أعد تسجيل الدخول.",
  };
  return messages[error.message] || "حدث خطأ أثناء الاتصال. تحقق من إعدادات Cloudflare ثم أعد المحاولة.";
}

async function readDefaultSite() {
  const response = await fetch("/", { cache: "no-store" });
  if (!response.ok) throw new Error("default_site_unavailable");
  const html = await response.text();
  const documentCopy = new DOMParser().parseFromString(html, "text/html");
  const stateElement = documentCopy.querySelector("script#state");
  if (!stateElement) throw new Error("default_site_missing");
  return JSON.parse(stateElement.textContent);
}

async function loadWorkspace() {
  const siteResult = await api("/api/admin/site");
  site = siteResult.site || await readDefaultSite();
  if (!site.t) site.t = {};
  if (!site.img) site.img = { logo: "", hero: "", dev: "" };
  site.social = { fb: "", tt: "", ig: "", ...(site.social || {}) };
  if (!Array.isArray(site.ach)) site.ach = [];
  if (!Array.isArray(site.gal)) site.gal = [];
  if (!Array.isArray(site.news)) site.news = [];
  if (!Array.isArray(applications)) applications = [];
  await loadApplications();
  $("#loginView").hidden = true;
  $("#dashboardView").hidden = false;
  $("#logoutButton").hidden = false;
  setConnection("online", "متصل بقاعدة البيانات");
  renderPanel();
}

async function loadApplications() {
  const data = await api("/api/admin/applications", { cache: "no-store" });
  applications = Array.isArray(data.applications) ? data.applications : [];
  const fresh = applications.filter((item) => item.state === "جديد").length;
  $("#newCount").textContent = String(fresh);
}

function showLogin(message = "") {
  $("#loginView").hidden = false;
  $("#dashboardView").hidden = true;
  $("#logoutButton").hidden = true;
  $("#loginMessage").textContent = message;
  setConnection("offline", "غير متصل بلوحة الإدارة");
}

function renderPanel() {
  const panel = $("#panel");
  const title = labels[currentView] || labels.overview;
  $("#breadcrumb").textContent = title;
  $("#pageTitle").textContent = title;
  $$(".side-link").forEach((button) => button.classList.toggle("active", button.dataset.view === currentView));
  if (currentView === "overview") panel.innerHTML = renderOverview();
  if (currentView === "applications") panel.innerHTML = renderApplications();
  if (currentView === "content") panel.innerHTML = renderContent();
  if (currentView === "stories") panel.innerHTML = renderStories();
  if (currentView === "media") panel.innerHTML = renderMedia();
  if (currentView === "links") panel.innerHTML = renderLinks();
}

function renderOverview() {
  const fresh = applications.filter((item) => item.state === "جديد").length;
  const review = applications.filter((item) => item.state === "قيد المراجعة").length;
  const done = applications.filter((item) => item.state === "تم التواصل").length;
  const last = applications.slice(0, 4);
  return `<div class="stats">
    <article class="stat-card"><span>إجمالي الطلبات</span><b>${applications.length}</b></article>
    <article class="stat-card"><span>طلبات جديدة</span><b class="stat-accent">${fresh}</b></article>
    <article class="stat-card"><span>قيد المراجعة / تم التواصل</span><b>${review + done}</b></article>
  </div>
  <section class="section-card"><div class="section-head"><h2>أحدث طلبات التقديم</h2><button class="button" data-action="view-applications">عرض الصندوق</button></div>
  ${last.length ? `<div class="inbox-list">${last.map(applicationCard).join("")}</div>` : `<div class="empty-state"><b>صندوق التقديم جاهز</b>ستظهر هنا الطلبات المرسلة من نموذج الموقع بعد إعداد قاعدة البيانات.</div>`}</section>
  <section class="section-card"><h2>إدارة سريعة</h2><div class="quick-links"><button class="button" data-action="view-content">تعديل نصوص الموقع</button><button class="button" data-action="view-links">ضبط روابط التواصل</button><button class="button" data-action="view-media">تغيير الصور والشعار</button></div></section>`;
}

function applicationCard(item) {
  const created = item.createdAt ? new Date(item.createdAt).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" }) : "";
  const safePhone = String(item.phone || "").replace(/[^\d+]/g, "");
  const wa = safePhone ? `https://wa.me/${safePhone}` : "#";
  return `<article class="application-card ${item.state === "جديد" ? "is-new" : ""}">
    <div class="application-top"><div><p class="app-name">${escapeHtml(item.name)}</p><span class="app-date">وُرد في ${escapeHtml(created)}</span></div><span class="app-date">${escapeHtml(item.id)}</span></div>
    <div class="application-fields"><span><b>المدينة:</b>${escapeHtml(item.city)}</span><span><b>القسم:</b>${escapeHtml(item.dept)}</span><span><b>السنة:</b>${escapeHtml(item.year)}</span><span><b>الحالة:</b>${escapeHtml(item.memberStatus)}</span><span><b>الجوال:</b>${escapeHtml(item.phone)}</span></div>
    <div class="application-actions"><label for="state-${escapeHtml(item.id)}">حالة المتابعة</label><select id="state-${escapeHtml(item.id)}" data-app-state="${escapeHtml(item.id)}">${statusOptions.map((state) => `<option ${item.state === state ? "selected" : ""}>${state}</option>`).join("")}</select><a href="${wa}" target="_blank" rel="noopener noreferrer">فتح واتساب</a><button class="button button-danger" data-delete-app="${escapeHtml(item.id)}" type="button">حذف الطلب</button></div>
  </article>`;
}

function renderApplications() {
  return `<section class="section-card"><div class="section-head"><div><h2>صندوق طلبات التقديم</h2><span class="help">تُحفظ الطلبات مركزيًا في قاعدة البيانات، ويمكن تغيير حالة المتابعة أو حذف الطلب.</span></div><div class="inbox-tools"><button class="button" data-action="refresh-applications">تحديث الصندوق</button></div></div>
    ${applications.length ? `<div class="inbox-list">${applications.map(applicationCard).join("")}</div>` : `<div class="empty-state"><b>لا توجد طلبات حتى الآن</b>عند إرسال نموذج التقديم من الموقع سيظهر الطلب هنا تلقائيًا.</div>`}
  </section>`;
}

function textField(key, label, fallback, help = "") {
  const value = site.t[key] ?? fallback;
  const isLong = key.endsWith("_b");
  return `<div class="field ${isLong ? "full" : ""}"><label for="text-${key}">${escapeHtml(label)}</label>${isLong ? `<textarea id="text-${key}" data-site-text="${key}" rows="4">${escapeHtml(value)}</textarea>` : `<input id="text-${key}" data-site-text="${key}" value="${escapeHtml(value)}">`}${help ? `<small>${escapeHtml(help)}</small>` : ""}</div>`;
}

function renderContent() {
  return `<section class="section-card"><div class="section-head"><div><h2>النصوص الرئيسية</h2><span class="help">عدّل النص ثم انتظر الحفظ التلقائي أو استخدم زر «حفظ التغييرات» أعلى الصفحة.</span></div></div><div class="grid-2">${textFields.map((field) => textField(...field)).join("")}</div></section>`;
}

function renderStoryCard(kind, item, index) {
  const title = kind === "ach" ? "إنجاز" : "خبر";
  return `<article class="story-card"><div class="story-top"><b>${title} ${index + 1}</b><button class="button button-danger" type="button" data-delete-story="${kind}" data-id="${escapeHtml(item.id)}">حذف</button></div>
    <div class="story-fields"><div class="field"><label>العنوان</label><input data-story-kind="${kind}" data-story-id="${escapeHtml(item.id)}" data-story-field="title" value="${escapeHtml(item.title || "")}"></div><div class="field"><label>التفاصيل</label><textarea rows="2" data-story-kind="${kind}" data-story-id="${escapeHtml(item.id)}" data-story-field="text">${escapeHtml(item.text || "")}</textarea></div></div>
    <div class="inline-actions"><label class="file-control">صورة اختيارية <input type="file" accept="image/*" data-story-image="${kind}" data-id="${escapeHtml(item.id)}"></label></div></article>`;
}

function renderStories() {
  return `<section class="section-card"><div class="section-head"><div><h2>إنجازات الفريق</h2><span class="help">أضف أو عدّل بطاقات الإنجاز التي تظهر في صفحة الموقع.</span></div><button class="button button-primary" data-add-story="ach">إضافة إنجاز</button></div><div class="cards-list">${site.ach.length ? site.ach.map((item, i) => renderStoryCard("ach", item, i)).join("") : `<div class="empty-state"><b>لا توجد إنجازات مضافة</b>أضف أول إنجاز ليظهر للزوار.</div>`}</div></section>
  <section class="section-card"><div class="section-head"><div><h2>الأخبار</h2><span class="help">أضف الأخبار والتحديثات، وستُحفظ على الموقع بعد المزامنة.</span></div><button class="button button-primary" data-add-story="news">إضافة خبر</button></div><div class="cards-list">${site.news.length ? site.news.map((item, i) => renderStoryCard("news", item, i)).join("") : `<div class="empty-state"><b>لا توجد أخبار مضافة</b>أضف خبرًا جديدًا من الزر أعلاه.</div>`}</div></section>`;
}

function imageCard(key, label, note = "") {
  const src = site.img[key] || "";
  return `<article class="media-card"><img class="media-preview ${key === "logo" ? "contain" : ""}" src="${escapeHtml(src || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=")}" alt="${escapeHtml(label)}"><h3>${escapeHtml(label)}</h3><label class="file-control">اختيار صورة<input type="file" accept="image/*" data-site-image="${key}"></label>${note ? `<small class="help">${escapeHtml(note)}</small>` : ""}</article>`;
}

function renderMedia() {
  const gallery = site.gal || [];
  return `<section class="section-card"><div class="section-head"><div><h2>الشعار والصور الأساسية</h2><span class="help">تُضغط الصور داخل المتصفح قبل رفعها. ارفع الصور التي تملك حق استخدامها.</span></div></div><div class="media-grid">${imageCard("logo", "شعار حياة تيم", "يفضل صورة PNG شفافة")}${imageCard("hero", "صورة الواجهة الرئيسية")}${imageCard("dev", "صورة المطور")}</div></section>
  <section class="section-card"><div class="section-head"><div><h2>معرض الصور</h2><span class="help">الصور تضاف إلى المعرض في الموقع.</span></div><label class="button button-primary">إضافة صور<input type="file" accept="image/*" multiple data-add-gallery hidden></label></div>
  ${gallery.length ? `<div class="gallery-grid">${gallery.map((item) => `<div class="gallery-item"><img src="${escapeHtml(item.img || "")}" alt="صورة من المعرض"><button class="button button-danger" type="button" data-delete-gallery="${escapeHtml(item.id)}">حذف</button></div>`).join("")}</div>` : `<div class="empty-state"><b>المعرض فارغ</b>اختر صورًا لإضافتها إلى الموقع.</div>`}
  <p class="media-limit">حد قاعدة البيانات لهذا المحتوى 1.8 ميغابايت إجمالًا لكل نسخة محفوظة. عند بلوغه قلّل عدد الصور أو حجمها.</p></section>`;
}

function renderLinks() {
  return `<section class="section-card"><div class="section-head"><div><h2>روابط الشبكات الاجتماعية والتواصل</h2><span class="help">تُحدّث الروابط الظاهرة في الموقع لجميع الزوار عند الحفظ.</span></div></div><div class="grid-2">
    <div class="field"><label for="social-fb">رابط صفحة فيسبوك</label><input id="social-fb" type="url" dir="ltr" data-social="fb" placeholder="https://www.facebook.com/your-page" value="${escapeHtml(site.social.fb || "")}"><small>استخدم رابطًا يبدأ بـ https://facebook.com أو fb.com.</small></div>
    <div class="field"><label for="social-tt">رابط حساب تيك توك</label><input id="social-tt" type="url" dir="ltr" data-social="tt" placeholder="https://www.tiktok.com/@your-account" value="${escapeHtml(site.social.tt || "")}"><small>استخدم رابطًا يبدأ بـ https://tiktok.com.</small></div>
    <div class="field"><label for="social-ig">رابط حساب إنستغرام</label><input id="social-ig" type="url" dir="ltr" data-social="ig" placeholder="https://www.instagram.com/your-account" value="${escapeHtml(site.social.ig || "")}"><small>استخدم رابطًا يبدأ بـ https://instagram.com.</small></div>
    <div class="field"><label for="contact-wa">رقم واتساب للتواصل</label><input id="contact-wa" inputmode="numeric" dir="ltr" data-site-value="wa" placeholder="مثال: 9665XXXXXXXX" value="${escapeHtml(site.wa || "")}"><small>اكتب رمز الدولة والرقم أرقامًا فقط، بلا + أو مسافات.</small></div>
  </div></section>
  <section class="section-card"><h2>معلومة عن التقديم</h2><p class="help">طلبات التقديم تُحفظ في صندوق «طلبات التقديم» داخل هذه اللوحة. لا تعتمد على واتساب أو بريد خارجي بدلًا من صندوق الطلبات؛ إذا تعطلت قاعدة البيانات سيظهر للمتقدم تنبيه بإعادة المحاولة.</p></section>`;
}

function markChanged() {
  revision += 1;
  setSaveStatus("تغييرات غير محفوظة — جارٍ الحفظ تلقائيًا…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSite(false), 900);
}

async function saveSite(showToast = true) {
  clearTimeout(saveTimer);
  if (!site || revision === savedRevision) {
    if (showToast) toast("لا توجد تغييرات جديدة.");
    return;
  }
  if (saving) {
    saveTimer = setTimeout(() => saveSite(showToast), 500);
    return;
  }
  saving = true;
  const sentRevision = revision;
  setSaveStatus("جارٍ حفظ التغييرات…");
  try {
    await api("/api/admin/site", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ site }) });
    savedRevision = sentRevision;
    setSaveStatus(revision === savedRevision ? "تم حفظ الموقع في قاعدة البيانات" : "حُفظت النسخة السابقة؛ جارٍ حفظ أحدث تعديل", revision === savedRevision ? "ok" : "");
    setConnection("online", "متصل بقاعدة البيانات");
    if (showToast) toast("تم حفظ التغييرات للموقع.");
  } catch (error) {
    setSaveStatus(explainError(error), "error");
    setConnection("offline", "تعذّر الحفظ");
    if (showToast) toast(explainError(error));
  } finally {
    saving = false;
    if (revision > savedRevision) saveTimer = setTimeout(() => saveSite(false), 300);
  }
}

function newId() { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; }

async function fileToImageData(file) {
  if (!file || !file.type.startsWith("image/")) throw new Error("اختَر ملف صورة صالحًا.");
  if (file.size > 15_000_000) throw new Error("حجم الصورة الأصلية أكبر من 15 ميغابايت.");
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, 1500 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  let data = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const quality = [0.82, 0.74, 0.65, 0.55][attempt];
    data = canvas.toDataURL("image/jpeg", quality);
    if (data.length < 820_000) break;
    scale *= 0.78;
  }
  bitmap.close?.();
  if (data.length >= 900_000) throw new Error("تعذّر ضغط الصورة إلى الحد المسموح؛ اختر صورة أصغر.");
  return data;
}

async function refreshApplications() {
  try {
    await loadApplications();
    renderPanel();
    toast("تم تحديث صندوق الطلبات.");
  } catch (error) {
    toast(explainError(error));
  }
}

async function updateApplication(id, state) {
  try {
    await api(`/api/admin/applications/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ state }) });
    await loadApplications();
    renderPanel();
    toast("تم تحديث حالة الطلب.");
  } catch (error) {
    toast(explainError(error));
    refreshApplications();
  }
}

async function deleteApplication(id) {
  if (!window.confirm("هل تريد حذف طلب التقديم هذا نهائيًا؟")) return;
  try {
    await api(`/api/admin/applications/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadApplications();
    renderPanel();
    toast("تم حذف الطلب.");
  } catch (error) { toast(explainError(error)); }
}

async function signOut() {
  try { await api("/api/admin/logout", { method: "POST" }); } catch (_) {}
  site = null;
  applications = [];
  showLogin("تم تسجيل الخروج.");
  $("#adminPassword").value = "";
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#loginForm button[type=submit]");
  button.disabled = true;
  $("#loginMessage").textContent = "جارٍ التحقق…";
  try {
    await api("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: $("#adminPassword").value }) });
    await loadWorkspace();
    $("#loginMessage").textContent = "";
  } catch (error) {
    $("#loginMessage").textContent = explainError(error);
  } finally { button.disabled = false; }
});

$("#logoutButton").addEventListener("click", signOut);
$("#saveButton").addEventListener("click", () => saveSite(true));

$(".sidebar").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  currentView = button.dataset.view;
  renderPanel();
});

$("#panel").addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "view-applications") { currentView = "applications"; renderPanel(); return; }
  if (action === "view-content") { currentView = "content"; renderPanel(); return; }
  if (action === "view-links") { currentView = "links"; renderPanel(); return; }
  if (action === "view-media") { currentView = "media"; renderPanel(); return; }
  if (action === "refresh-applications") { await refreshApplications(); return; }
  const appDelete = event.target.closest("[data-delete-app]");
  if (appDelete) { await deleteApplication(appDelete.dataset.deleteApp); return; }
  const addStory = event.target.closest("[data-add-story]");
  if (addStory) {
    const kind = addStory.dataset.addStory;
    site[kind].push({ id: newId(), title: kind === "ach" ? "إنجاز جديد" : "خبر جديد", text: "أضف التفاصيل هنا.", img: "" });
    markChanged(); renderPanel(); return;
  }
  const deleteStory = event.target.closest("[data-delete-story]");
  if (deleteStory) {
    const { deleteStory: kind, id } = deleteStory.dataset;
    site[kind] = site[kind].filter((item) => item.id !== id);
    markChanged(); renderPanel(); return;
  }
  const deleteGallery = event.target.closest("[data-delete-gallery]");
  if (deleteGallery) {
    site.gal = site.gal.filter((item) => item.id !== deleteGallery.dataset.deleteGallery);
    markChanged(); renderPanel(); return;
  }
});

$("#panel").addEventListener("input", (event) => {
  const text = event.target.closest("[data-site-text]");
  if (text) { site.t[text.dataset.siteText] = text.value; markChanged(); return; }
  const social = event.target.closest("[data-social]");
  if (social) { site.social[social.dataset.social] = social.value.trim(); markChanged(); return; }
  const siteValue = event.target.closest("[data-site-value]");
  if (siteValue) { site[siteValue.dataset.siteValue] = siteValue.value.replace(/\D/g, ""); markChanged(); return; }
  const story = event.target.closest("[data-story-kind]");
  if (story) {
    const item = site[story.dataset.storyKind].find((entry) => entry.id === story.dataset.storyId);
    if (item) item[story.dataset.storyField] = story.value;
    markChanged();
  }
});

$("#panel").addEventListener("change", async (event) => {
  const appState = event.target.closest("[data-app-state]");
  if (appState) { await updateApplication(appState.dataset.appState, appState.value); return; }
  const siteImage = event.target.closest("[data-site-image]");
  const storyImage = event.target.closest("[data-story-image]");
  const galleryFiles = event.target.closest("[data-add-gallery]");
  try {
    if (siteImage?.files?.[0]) {
      site.img[siteImage.dataset.siteImage] = await fileToImageData(siteImage.files[0]);
      markChanged(); renderPanel(); toast("تم تحديث الصورة؛ تُحفظ تلقائيًا.");
    } else if (storyImage?.files?.[0]) {
      const item = site[storyImage.dataset.storyImage].find((entry) => entry.id === storyImage.dataset.id);
      if (item) item.img = await fileToImageData(storyImage.files[0]);
      markChanged(); renderPanel(); toast("تم تحديث صورة العنصر.");
    } else if (galleryFiles?.files?.length) {
      const selected = [...galleryFiles.files].slice(0, 20);
      for (const file of selected) site.gal.push({ id: newId(), img: await fileToImageData(file) });
      markChanged(); renderPanel(); toast(`أُضيفت ${selected.length} صورة إلى المعرض.`);
    }
  } catch (error) { toast(error.message || "تعذّر تحميل الصورة."); }
});

async function init() {
  setConnection("", "جارٍ التحقق من الاتصال");
  try {
    await api("/api/admin/session", { cache: "no-store" });
    await loadWorkspace();
  } catch (error) {
    // 401 means the visitor is simply not signed in yet, not that the API is broken.
    showLogin(error.status === 401 || error.message === "http_401" || error.message === "unauthorized" ? "" : explainError(error));
  }
}

init();
