let subjects = [];
let tasks = [];
let myName = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDay = null;
let activeSubjectFilter = 'all';
let expandedTaskId = null;
let calView = 'month';
let subjectsLoaded = false;
let tasksLoaded = false;

const PALETTE = [
  {name:'verde', hex:'#3F8F76'}, {name:'dorado', hex:'#C98A2E'}, {name:'terracota', hex:'#B5714A'},
  {name:'violeta', hex:'#7C6FB0'}, {name:'salvia', hex:'#6E8F5C'}, {name:'azul', hex:'#4E7FA3'},
  {name:'mostaza', hex:'#B99A2E'}, {name:'vino', hex:'#A85A6B'}
];

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_ABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DOW = ['D','L','M','M','J','V','S'];
const DOW_ABR = ['dom','lun','mar','mié','jue','vie','sáb'];
const MONTH_NAME_MAP = {enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,setiembre:8,octubre:9,noviembre:10,diciembre:11};

function pad2(n) { return String(n).padStart(2,'0'); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function parseDateOnly(str) { const [y,m,d] = str.split('-').map(Number); return new Date(y, m-1, d); }

/* ---- Arranque: nombre en localStorage (por dispositivo), datos en Firestore (compartidos) ---- */
function init() {
  try { myName = localStorage.getItem('parciales-my-name'); } catch (e) { myName = null; }
  if (!myName) { document.getElementById('name-gate').style.display = 'flex'; return; }
  enterApp();
}

function saveName() {
  const val = document.getElementById('name-input').value.trim();
  if (!val) return;
  try { localStorage.setItem('parciales-my-name', val); } catch (e) { console.error(e); }
  myName = val;
  document.getElementById('name-gate').style.display = 'none';
  enterApp();
}

function changeName() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('name-input').value = myName || '';
  document.getElementById('name-gate').style.display = 'flex';
}

function enterApp() {
  document.getElementById('who-name').textContent = myName;
  document.getElementById('loading-gate').style.display = 'flex';

  db.collection('subjects').onSnapshot(snap => {
    subjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    subjectsLoaded = true;
    afterFirstLoad();
    render();
  }, err => console.error('Error leyendo materias:', err));

  db.collection('tasks').onSnapshot(snap => {
    tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    tasksLoaded = true;
    afterFirstLoad();
    render();
  }, err => console.error('Error leyendo tareas:', err));
}

function afterFirstLoad() {
  if (subjectsLoaded && tasksLoaded) {
    document.getElementById('loading-gate').style.display = 'none';
    document.getElementById('app').style.display = 'block';
  }
}

function subjectById(id) { return subjects.find(s => s.id === id); }

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const due = parseDateOnly(dateStr);
  return Math.round((due - today) / 86400000);
}

function formatDateHuman(dateStr, timeStr) {
  const d = parseDateOnly(dateStr);
  let out = `${DOW_ABR[d.getDay()]} ${d.getDate()} ${MESES_ABR[d.getMonth()]}`;
  if (timeStr) out += ` · ${timeStr}`;
  return out;
}

function render() {
  renderTabs();
  renderCalPanel();
  renderTaskList();
}

function renderTabs() {
  const wrap = document.getElementById('tabs');
  let html = `<div class="tab ${activeSubjectFilter==='all'?'active':''}" onclick="setFilter('all')">Todas</div>`;
  subjects.forEach(s => {
    html += `<div class="tab ${activeSubjectFilter===s.id?'active':''}" style="color:${activeSubjectFilter===s.id?s.color:''}" onclick="setFilter('${s.id}')">
      <span class="dot" style="background:${s.color}"></span>${escapeHtml(s.name)}
      <span onclick="event.stopPropagation(); openSubjectModal('${s.id}')" title="Editar materia" style="font-size:11px; color:var(--text-faint); margin-left:2px;">✎</span>
    </div>`;
  });
  html += `<div class="tab add-tab" onclick="openSubjectModal()">+ materia</div>`;
  wrap.innerHTML = html;
}

function setFilter(id) { activeSubjectFilter = id; render(); }

function setCalView(v) {
  calView = v;
  document.getElementById('main-grid').classList.toggle('stacked', v !== 'month');
  renderCalPanel();
}

function renderCalPanel() {
  document.getElementById('vt-month').classList.toggle('active', calView === 'month');
  document.getElementById('vt-timeline').classList.toggle('active', calView === 'timeline');
  document.getElementById('vt-historial').classList.toggle('active', calView === 'historial');
  const container = document.getElementById('cal-container');
  if (calView === 'month') {
    container.innerHTML = `
      <div class="cal-nav">
        <button onclick="shiftMonth(-1)">‹</button>
        <div class="month-label" id="month-label"></div>
        <button onclick="shiftMonth(1)">›</button>
      </div>
      <div class="cal-grid" id="cal-dow"></div>
      <div class="cal-grid" id="cal-grid" style="margin-top:4px;"></div>
    `;
    renderCalendar();
  } else if (calView === 'timeline') {
    container.innerHTML = `<div id="gantt-root"></div>`;
    renderTimeline();
  } else {
    container.innerHTML = `<div id="historial-root"></div>`;
    renderHistorial();
  }
}

function renderHistorial() {
  const root = document.getElementById('historial-root');
  let list = tasks.filter(t => t.status === 'hecho' || t.status === 'eliminada');
  if (activeSubjectFilter !== 'all') list = list.filter(t => t.subjectId === activeSubjectFilter);
  list.sort((a,b) => (b.dueDate).localeCompare(a.dueDate));

  if (list.length === 0) {
    root.innerHTML = `<div class="empty-state">Todavía no hay tareas completadas ni eliminadas.</div>`;
    return;
  }

  root.innerHTML = `<div class="task-list" style="max-height:520px;">` + list.map(t => {
    const s = subjectById(t.subjectId);
    const color = s ? s.color : '#888';
    const isDone = t.status === 'hecho';
    const badge = isDone
      ? `<span style="color:var(--accent-teal); font-weight:600;">Completada</span>`
      : `<span style="color:var(--accent-danger); font-weight:600;">Eliminada</span>`;
    return `<div class="task-card" style="cursor:default;">
      <div class="task-top">
        <span class="chip" style="background:${color}"></span>
        <span class="title">${escapeHtml(t.title)}</span>
      </div>
      <div class="task-meta">
        <span>${formatDateHuman(t.dueDate, t.dueTime)}</span>
        <span>${s ? escapeHtml(s.name) : ''}</span>
        <span>${badge}</span>
      </div>
      <div class="detail-actions">
        <button onclick="restoreTask('${t.id}')">Agregar a próximas</button>
        ${!isDone ? `<button class="danger" onclick="hardDeleteTask('${t.id}')">Eliminar definitivamente</button>` : ''}
      </div>
    </div>`;
  }).join('') + `</div>`;
}

function renderCalendar() {
  document.getElementById('month-label').textContent = `${MESES[currentMonth]} ${currentYear}`;
  document.getElementById('cal-dow').innerHTML = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');

  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  const tStr = todayStr();

  let cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({day: daysInPrevMonth - i, other: true});
  for (let d = 1; d <= daysInMonth; d++) cells.push({day: d, other: false});
  while (cells.length % 7 !== 0) cells.push({day: cells.length, other: true});

  const filteredTasks = tasks.filter(t => t.status !== 'eliminada' && (activeSubjectFilter === 'all' || t.subjectId === activeSubjectFilter));

  let html = '';
  cells.forEach(c => {
    if (c.other) { html += `<div class="cal-day other-month">${c.day}</div>`; return; }
    const dateStr = `${currentYear}-${pad2(currentMonth+1)}-${pad2(c.day)}`;
    const dayTasks = filteredTasks.filter(t => t.dueDate === dateStr);
    const isToday = dateStr === tStr;
    const isSelected = dateStr === selectedDay;
    let dots = dayTasks.slice(0,4).map(t => {
      const s = subjectById(t.subjectId);
      return `<span style="background:${s ? s.color : '#888'}"></span>`;
    }).join('');
    html += `<div class="cal-day ${isToday?'today':''} ${isSelected?'selected':''}" onclick="selectDay('${dateStr}')">
      ${c.day}<div class="dots">${dots}</div>
    </div>`;
  });
  grid.innerHTML = html;
}

function selectDay(dateStr) {
  selectedDay = (selectedDay === dateStr) ? null : dateStr;
  renderTaskList();
  if (calView === 'month') renderCalendar(); else if (calView === 'timeline') renderTimeline();
}

function shiftMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
}

function renderTimeline() {
  const root = document.getElementById('gantt-root');
  if (subjects.length === 0) {
    root.innerHTML = `<div class="gantt-empty">Agregá una materia para ver la línea de tiempo.</div>`;
    return;
  }
  const today = new Date(); today.setHours(0,0,0,0);
  let maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 13);
  const activeTasks = tasks.filter(t => t.status !== 'eliminada');
  activeTasks.forEach(t => { const d = parseDateOnly(t.dueDate); if (d > maxDate) maxDate = d; });
  let dayCount = Math.round((maxDate - today) / 86400000) + 1;
  if (dayCount > 60) dayCount = 60;
  if (dayCount < 7) dayCount = 7;

  const tStr = todayStr();
  let headerHtml = '';
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    const ds = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    headerHtml += `<div class="gantt-cellhdr ${ds===tStr?'today':''}">${d.getDate()}</div>`;
  }

  let rowsHtml = '';
  subjects.forEach(s => {
    let trackHtml = '';
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      const ds = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      let dayTasks = activeTasks.filter(t => t.subjectId === s.id && t.dueDate === ds);
      let cellStyle = '', cellContent = '', cellAttrs = '';
      if (dayTasks.length === 1) {
        cellStyle = `background:${s.color}; border-radius:4px; margin:2px 1px; cursor:pointer;`;
        cellAttrs = `onclick="selectDay('${ds}')" title="${escapeHtml(dayTasks[0].title)}"`;
      } else if (dayTasks.length > 1) {
        cellStyle = `background:${s.color}; border-radius:4px; margin:2px 1px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:10px; color:#FFFDF8; font-weight:700;`;
        cellAttrs = `onclick="selectDay('${ds}')" title="${dayTasks.length} tareas"`;
        cellContent = dayTasks.length;
      }
      trackHtml += `<div class="gantt-cell ${ds===tStr?'today-col':''}" style="${cellStyle}" ${cellAttrs}>${cellContent}</div>`;
    }
    rowsHtml += `<div class="gantt-row">
      <div class="gantt-label"><span class="dot" style="background:${s.color}"></span>${escapeHtml(s.name)}</div>
      <div class="gantt-track">${trackHtml}</div>
    </div>`;
  });

  root.innerHTML = `<div class="gantt-wrap">
    <div class="gantt-header">${headerHtml}</div>
    ${rowsHtml}
  </div>`;
}

function computeStudyPlan(t) {
  const pending = t.checklist.filter(c => !c.done);
  const days = daysUntil(t.dueDate);
  if (pending.length === 0 || days < 0 || t.status === 'hecho') return null;
  const numDays = Math.min(pending.length, Math.max(days, 1), 4);
  const buckets = Array.from({length: numDays}, () => []);
  pending.forEach((item, i) => buckets[i % numDays].push(item.text));
  const today = new Date();
  return buckets.map((items, i) => {
    let label;
    if (i === 0) label = 'Hoy';
    else if (i === 1) label = 'Mañana';
    else { const d = new Date(today); d.setDate(d.getDate() + i); label = DOW_ABR[d.getDay()]; }
    return { label, items };
  });
}

function renderTaskList() {
  document.getElementById('list-title').textContent = selectedDay ? `Tareas · ${formatDateHuman(selectedDay)}` : 'Próximas';

  let list = tasks.filter(t => t.status !== 'eliminada' && (activeSubjectFilter === 'all' || t.subjectId === activeSubjectFilter));
  if (selectedDay) list = list.filter(t => t.dueDate === selectedDay);
  list.sort((a,b) => (a.dueDate + (a.dueTime||'')).localeCompare(b.dueDate + (b.dueTime||'')));

  const wrap = document.getElementById('task-list');
  if (list.length === 0) {
    wrap.innerHTML = `<div class="empty-state">No hay tareas ${selectedDay ? 'ese día' : 'pendientes'}.</div>`;
    return;
  }

  wrap.innerHTML = list.map(t => {
    const s = subjectById(t.subjectId);
    const color = s ? s.color : '#888';
    const days = daysUntil(t.dueDate);
    let metaClass = '', metaText = formatDateHuman(t.dueDate, t.dueTime);
    if (t.status !== 'hecho') {
      if (days < 0) { metaClass = 'overdue'; metaText += ` · vencida hace ${Math.abs(days)}d`; }
      else if (days === 0) { metaClass = 'urgent'; metaText += ' · ¡hoy!'; }
      else if (days <= 3) { metaClass = 'urgent'; metaText += ` · en ${days}d`; }
      else { metaText += ` · en ${days}d`; }
    }
    const isExpanded = expandedTaskId === t.id;
    const doneCount = t.checklist.filter(c => c.done).length;
    const notes = t.notes || '';

    let detailHtml = '';
    if (isExpanded) {
      const plan = computeStudyPlan(t);
      let planHtml = '';
      if (plan) {
        planHtml = `<div class="detail-label">Plan de estudio</div>
        <div class="study-plan-row">
          ${plan.map(p => `<div class="study-plan-chip">${p.label}<b>${escapeHtml(p.items.join(', '))}</b></div>`).join('')}
        </div>`;
      }
      detailHtml = `<div class="task-detail" onclick="event.stopPropagation()">
        ${planHtml}
        <div class="detail-label">Temas a repasar</div>
        ${t.checklist.map(ci => `
          <div class="checklist-item">
            <input type="checkbox" ${ci.done?'checked':''} onchange="toggleChecklistItem('${t.id}','${ci.id}')" />
            <span class="${ci.done?'done':''}">${escapeHtml(ci.text)}</span>
          </div>`).join('')}
        <div class="add-checklist-row">
          <input type="text" id="new-item-${t.id}" placeholder="Agregar tema..." onkeydown="if(event.key==='Enter') addChecklistItem('${t.id}')" />
          <button class="chip-remove" onclick="addChecklistItem('${t.id}')">+</button>
        </div>
        <div class="detail-label">Mis apuntes</div>
        <textarea class="notes-box" id="notes-${t.id}" placeholder="Escribí tu resumen o repaso aquí...">${escapeHtml(notes)}</textarea>
        <div><span class="notes-save" onclick="saveNotes('${t.id}')">Guardar nota</span></div>

        <div class="detail-label" style="margin-top:14px;">Fecha y hora de entrega</div>
        <div class="date-time-row" style="margin-bottom:8px;">
          <div class="field" style="margin-bottom:0;"><input type="date" id="edit-date-${t.id}" value="${t.dueDate}" /></div>
          <div class="field" style="margin-bottom:0;"><input type="time" id="edit-time-${t.id}" value="${t.dueTime || ''}" /></div>
        </div>
        <div style="margin-bottom:8px;"><span class="notes-save" onclick="saveDueDateTime('${t.id}')">Guardar fecha/hora</span></div>

        <div class="detail-label" style="margin-top:14px;">Recordatorio para empezar a estudiar</div>
        <div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">
          <span style="font-size:12px; color:var(--text-muted);">Días antes:</span>
          <input type="text" id="reminder-days-${t.id}" value="${t.reminderDays || 3}" inputmode="numeric" style="width:44px; background:var(--input-bg); border:1px solid var(--card-border); border-radius:var(--radius-sm); padding:4px 6px; font-size:12px; color:var(--text-dark);" />
          <button onclick="openReminderCal('${t.id}')" style="background:none; border:none; color:var(--accent-teal); font-size:12px; cursor:pointer; text-decoration:underline; padding:0;">Agregar a Google Calendar</button>
        </div>

        <div class="detail-actions">
          <button onclick="toggleTaskDone('${t.id}')">${t.status==='hecho' ? 'Marcar pendiente' : 'Marcar como hecha'}</button>
          <a href="${googleCalUrl(t)}" target="_blank" rel="noopener">Entrega a Google Calendar</a>
          <button class="danger" onclick="deleteTask('${t.id}')">Eliminar</button>
        </div>
      </div>`;
    }

    return `<div class="task-card ${isExpanded?'expanded':''} ${t.status==='hecho'?'done':''}" onclick="toggleExpand('${t.id}')">
      <div class="task-top">
        <span class="chip" style="background:${color}"></span>
        <span class="title ${t.status==='hecho'?'done-text':''}">${escapeHtml(t.title)}</span>
      </div>
      <div class="task-meta">
        <span class="${metaClass}">${metaText}</span>
        <span>${s ? escapeHtml(s.name) : ''}</span>
        <span>· ${escapeHtml(t.addedBy)}</span>
        ${t.checklist.length ? `<span>· ${doneCount}/${t.checklist.length} temas</span>` : ''}
      </div>
      ${detailHtml}
    </div>`;
  }).join('');
}

function toggleExpand(id) { expandedTaskId = expandedTaskId === id ? null : id; renderTaskList(); }

/* ---- Escrituras a Firestore: la vista se actualiza sola via onSnapshot ---- */
async function toggleChecklistItem(taskId, itemId) {
  const t = tasks.find(x => x.id === taskId);
  const updated = t.checklist.map(c => c.id === itemId ? {...c, done: !c.done} : c);
  try { await db.collection('tasks').doc(taskId).update({checklist: updated}); }
  catch (e) { console.error(e); }
}

async function addChecklistItem(taskId) {
  const input = document.getElementById(`new-item-${taskId}`);
  const text = input.value.trim();
  if (!text) return;
  const t = tasks.find(x => x.id === taskId);
  const updated = [...t.checklist, {id: 'c'+Date.now(), text, done: false}];
  try { await db.collection('tasks').doc(taskId).update({checklist: updated}); }
  catch (e) { console.error(e); }
}

async function saveDueDateTime(taskId) {
  const dueDate = document.getElementById(`edit-date-${taskId}`).value;
  const dueTime = document.getElementById(`edit-time-${taskId}`).value;
  if (!dueDate) { alert('La fecha no puede quedar vacía.'); return; }
  try { await db.collection('tasks').doc(taskId).update({dueDate, dueTime: dueTime || ''}); }
  catch (e) { console.error(e); alert('No se pudo guardar. Revisá tu conexión.'); }
}

async function saveNotes(taskId) {
  const val = document.getElementById(`notes-${taskId}`).value;
  try { await db.collection('tasks').doc(taskId).update({notes: val}); }
  catch (e) { console.error(e); }
}

async function toggleTaskDone(taskId) {
  const t = tasks.find(x => x.id === taskId);
  const newStatus = t.status === 'hecho' ? 'pendiente' : 'hecho';
  try { await db.collection('tasks').doc(taskId).update({status: newStatus}); }
  catch (e) { console.error(e); }
}

async function deleteTask(taskId) {
  try { await db.collection('tasks').doc(taskId).update({status: 'eliminada'}); }
  catch (e) { console.error(e); }
}

async function restoreTask(taskId) {
  try { await db.collection('tasks').doc(taskId).update({status: 'pendiente'}); }
  catch (e) { console.error(e); }
}

async function hardDeleteTask(taskId) {
  if (!confirm('¿Eliminar esta tarea para siempre? No se puede deshacer.')) return;
  try { await db.collection('tasks').doc(taskId).delete(); }
  catch (e) { console.error(e); }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : str;
  return d.innerHTML;
}

function googleCalUrl(t) {
  const s = subjectById(t.subjectId);
  const details = encodeURIComponent(`Materia: ${s ? s.name : ''}\nAgregado por: ${t.addedBy}`);
  const text = encodeURIComponent(t.title);
  if (t.dueTime) {
    const [hh, mm] = t.dueTime.split(':');
    const start = t.dueDate.replace(/-/g,'') + 'T' + hh + mm + '00';
    const endDateObj = new Date(t.dueDate + 'T' + t.dueTime + ':00');
    endDateObj.setHours(endDateObj.getHours() + 1);
    const end = `${endDateObj.getFullYear()}${pad2(endDateObj.getMonth()+1)}${pad2(endDateObj.getDate())}T${pad2(endDateObj.getHours())}${pad2(endDateObj.getMinutes())}00`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
  }
  const start = t.dueDate.replace(/-/g,'');
  const nextDate = new Date(t.dueDate + 'T00:00:00'); nextDate.setDate(nextDate.getDate()+1);
  const end = `${nextDate.getFullYear()}${pad2(nextDate.getMonth()+1)}${pad2(nextDate.getDate())}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
}

async function openReminderCal(taskId) {
  const t = tasks.find(x => x.id === taskId);
  const input = document.getElementById(`reminder-days-${taskId}`);
  const days = parseInt(input.value, 10);
  if (isNaN(days) || days < 0) { alert('Poné un número de días válido.'); return; }
  try { await db.collection('tasks').doc(taskId).update({reminderDays: days}); }
  catch (e) { console.error(e); }

  const s = subjectById(t.subjectId);
  const remindDate = parseDateOnly(t.dueDate);
  remindDate.setDate(remindDate.getDate() - days);
  const start = `${remindDate.getFullYear()}${pad2(remindDate.getMonth()+1)}${pad2(remindDate.getDate())}`;
  const nextDate = new Date(remindDate); nextDate.setDate(nextDate.getDate()+1);
  const end = `${nextDate.getFullYear()}${pad2(nextDate.getMonth()+1)}${pad2(nextDate.getDate())}`;
  const text = encodeURIComponent(`Estudiar: ${t.title}`);
  const details = encodeURIComponent(`Materia: ${s ? s.name : ''}\nEntrega: ${formatDateHuman(t.dueDate, t.dueTime)}`);
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
  window.open(url, '_blank', 'noopener');
}

function icsEscape(str) { return String(str).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n'); }

function downloadICS() {
  const pending = tasks.filter(t => t.status !== 'hecho' && t.status !== 'eliminada');
  if (pending.length === 0) { alert('No hay tareas pendientes para exportar.'); return; }
  const stamp = new Date().toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Parciales//ES\r\nCALSCALE:GREGORIAN\r\n';
  pending.forEach(t => {
    const s = subjectById(t.subjectId);
    ics += 'BEGIN:VEVENT\r\n';
    ics += `UID:${t.id}@parciales-app\r\n`;
    ics += `DTSTAMP:${stamp}\r\n`;
    if (t.dueTime) {
      const [hh,mm] = t.dueTime.split(':');
      ics += `DTSTART:${t.dueDate.replace(/-/g,'')}T${hh}${mm}00\r\n`;
    } else {
      ics += `DTSTART;VALUE=DATE:${t.dueDate.replace(/-/g,'')}\r\n`;
    }
    ics += `SUMMARY:${icsEscape(t.title)}\r\n`;
    ics += `DESCRIPTION:${icsEscape('Materia: ' + (s ? s.name : '') + ' - Agregado por: ' + t.addedBy)}\r\n`;
    ics += 'BEGIN:VALARM\r\nTRIGGER:-PT9H\r\nACTION:DISPLAY\r\nDESCRIPTION:Recordatorio de parcial\r\nEND:VALARM\r\n';
    if (t.reminderDays) {
      ics += `BEGIN:VALARM\r\nTRIGGER:-P${t.reminderDays}D\r\nACTION:DISPLAY\r\nDESCRIPTION:Empezar a estudiar\r\nEND:VALARM\r\n`;
    }
    ics += 'END:VEVENT\r\n';
  });
  ics += 'END:VCALENDAR\r\n';
  const blob = new Blob([ics], {type: 'text/calendar;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'parciales.ics';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---- Task modal ---- */
let newChecklist = [];
let selectedPriority = 'media';

function openTaskModal() {
  newChecklist = [];
  selectedPriority = 'media';
  if (subjects.length === 0) { openSubjectModal(); return; }
  const root = document.getElementById('task-modal-root');
  root.innerHTML = `
    <div class="overlay" onclick="if(event.target===this) closeTaskModal()">
      <div class="modal">
        <h3>Nueva tarea</h3>
        <div class="field"><label>Título</label><input type="text" id="t-title" placeholder="Ej. Segundo parcial de Redes" /></div>
        <div class="field"><label>Materia</label>
          <select id="t-subject">${subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
        </div>
        <div class="date-time-row">
          <div class="field"><label>Fecha de entrega</label><input type="date" id="t-date" /></div>
          <div class="field"><label>Hora (opcional)</label><input type="time" id="t-time" /></div>
        </div>
        <div class="field">
          <label>Prioridad</label>
          <div class="priority-row" id="priority-row">
            <button data-p="baja" onclick="setPriority('baja')">Baja</button>
            <button data-p="media" class="active" onclick="setPriority('media')">Media</button>
            <button data-p="alta" onclick="setPriority('alta')">Alta</button>
          </div>
        </div>
        <div class="field">
          <label>Recordatorio de estudio (días antes, opcional)</label>
          <input type="text" id="t-reminder-days" placeholder="Ej. 3" inputmode="numeric" />
        </div>
        <div class="field">
          <label>Temas a repasar (checklist)</label>
          <div class="checklist-build-row">
            <input type="text" id="t-checklist-input" placeholder="Ej. Subnetting" onkeydown="if(event.key==='Enter'){event.preventDefault(); addNewChecklistItem();}" />
            <button onclick="addNewChecklistItem()">+</button>
          </div>
          <div id="t-checklist-preview"></div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeTaskModal()">Cancelar</button>
          <button class="btn-primary" onclick="submitTask()">Guardar</button>
        </div>
      </div>
    </div>`;
}

function setPriority(p) {
  selectedPriority = p;
  document.querySelectorAll('#priority-row button').forEach(b => b.classList.toggle('active', b.dataset.p === p));
}
function addNewChecklistItem() {
  const input = document.getElementById('t-checklist-input');
  const val = input.value.trim();
  if (!val) return;
  newChecklist.push(val); input.value = '';
  renderChecklistPreview();
}
function renderChecklistPreview() {
  document.getElementById('t-checklist-preview').innerHTML = newChecklist.map((c,i) => `
    <div class="checklist-item"><span>• ${escapeHtml(c)}</span><button class="chip-remove" onclick="removeNewChecklistItem(${i})">×</button></div>`).join('');
}
function removeNewChecklistItem(i) { newChecklist.splice(i,1); renderChecklistPreview(); }
function closeTaskModal() { document.getElementById('task-modal-root').innerHTML = ''; }

async function submitTask() {
  const title = document.getElementById('t-title').value.trim();
  const subjectId = document.getElementById('t-subject').value;
  const dueDate = document.getElementById('t-date').value;
  const dueTime = document.getElementById('t-time').value;
  const reminderRaw = document.getElementById('t-reminder-days').value.trim();
  const reminderDays = reminderRaw ? parseInt(reminderRaw, 10) : null;
  if (!title || !dueDate) { alert('Poné al menos el título y la fecha.'); return; }
  try {
    await db.collection('tasks').add({
      title, subjectId, dueDate, dueTime: dueTime || '',
      priority: selectedPriority, status: 'pendiente',
      reminderDays: (reminderDays && !isNaN(reminderDays)) ? reminderDays : null,
      checklist: newChecklist.map(text => ({id: 'c'+Date.now()+Math.random().toString(36).slice(2,6), text, done:false})),
      notes: '', addedBy: myName, createdAt: Date.now()
    });
  } catch (e) { alert('No se pudo guardar la tarea. Revisá tu conexión.'); console.error(e); return; }
  closeTaskModal();
}

/* ---- Subject modal ---- */
let selectedColor = PALETTE[0].hex;
let editingSubjectId = null;

function openSubjectModal(editId) {
  editingSubjectId = editId || null;
  const editing = editingSubjectId ? subjectById(editingSubjectId) : null;
  selectedColor = editing ? editing.color : PALETTE[subjects.length % PALETTE.length].hex;
  document.getElementById('subject-modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this) closeSubjectModal()">
      <div class="modal">
        <h3>${editing ? 'Editar materia' : 'Nueva materia'}</h3>
        <div class="field"><label>Nombre</label><input type="text" id="s-name" placeholder="Ej. Redes, Bases de Datos..." value="${editing ? escapeHtml(editing.name) : ''}" /></div>
        <div class="field"><label>Color</label>
          <div class="color-row" id="color-row">
            ${PALETTE.map(p => `<div class="color-dot ${p.hex===selectedColor?'selected':''}" style="background:${p.hex}" onclick="pickColor('${p.hex}')"></div>`).join('')}
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:10px;">
            <input type="color" id="s-color-picker" value="${selectedColor}" onchange="onColorPickerChange()" style="width:36px; height:36px; border:1px solid var(--card-border); border-radius:6px; padding:0; background:none; cursor:pointer;" />
            <input type="text" id="s-color-hex" value="${selectedColor}" maxlength="7" placeholder="#RRGGBB" onchange="onHexInputChange()" style="width:100px; background:var(--input-bg); border:1px solid var(--card-border); border-radius:var(--radius-sm); padding:6px 8px; font-size:13px; color:var(--text-dark); font-family:monospace;" />
            <span style="font-size:11px; color:var(--text-faint);">o escribí el código</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeSubjectModal()">Cancelar</button>
          <button class="btn-primary" onclick="submitSubject()">Guardar</button>
        </div>
      </div>
    </div>`;
}
function pickColor(hex) {
  selectedColor = hex;
  document.querySelectorAll('#color-row .color-dot').forEach(d => d.classList.toggle('selected', d.style.background === hexToRgb(hex)));
  const picker = document.getElementById('s-color-picker'); if (picker) picker.value = hex;
  const hexInput = document.getElementById('s-color-hex'); if (hexInput) hexInput.value = hex;
}
function onColorPickerChange() {
  const val = document.getElementById('s-color-picker').value;
  selectedColor = val;
  document.getElementById('s-color-hex').value = val;
  document.querySelectorAll('#color-row .color-dot').forEach(d => d.classList.remove('selected'));
}
function onHexInputChange() {
  let val = document.getElementById('s-color-hex').value.trim();
  if (!val.startsWith('#')) val = '#' + val;
  if (!/^#[0-9A-Fa-f]{6}$/.test(val)) { alert('Ingresá un color hexadecimal válido, ej. #3F8F76'); return; }
  selectedColor = val;
  document.getElementById('s-color-picker').value = val;
  document.querySelectorAll('#color-row .color-dot').forEach(d => d.classList.remove('selected'));
}
function hexToRgb(hex) {
  const el = document.createElement('div'); el.style.background = hex; document.body.appendChild(el);
  const rgb = getComputedStyle(el).backgroundColor; document.body.removeChild(el); return rgb;
}
function closeSubjectModal() { document.getElementById('subject-modal-root').innerHTML = ''; editingSubjectId = null; }

async function submitSubject() {
  const name = document.getElementById('s-name').value.trim();
  if (!name) { alert('Ponele un nombre a la materia.'); return; }
  const wasEditing = editingSubjectId;
  try {
    if (wasEditing) {
      await db.collection('subjects').doc(wasEditing).update({name, color: selectedColor});
    } else {
      await db.collection('subjects').add({name, color: selectedColor});
    }
  } catch (e) { alert('No se pudo guardar la materia.'); console.error(e); return; }
  editingSubjectId = null;
  closeSubjectModal();
  if (!wasEditing) openTaskModal();
}

/* ---- Pegar lista (bulk import) ---- */
function openBulkModal() {
  document.getElementById('bulk-modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this) closeBulkModal()">
      <div class="modal">
        <h3>Pegar lista</h3>
        <p class="sub">Poné el nombre de la materia en una línea, y debajo las tareas con "- fecha". Ej:<br>Anato<br>* Reporte - domingo 20<br>* Parcial - jueves 24</p>
        <div class="field"><textarea id="bulk-text" placeholder="Anato&#10;* Reporte - domingo 20&#10;* Parcial - jueves 24"></textarea></div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeBulkModal()">Cancelar</button>
          <button class="btn-primary" onclick="submitBulkImport()">Importar</button>
        </div>
      </div>
    </div>`;
}
function closeBulkModal() { document.getElementById('bulk-modal-root').innerHTML = ''; }

function parseSpanishDate(text) {
  const clean = text.toLowerCase();
  const dayMatch = clean.match(/(\d{1,2})/);
  if (!dayMatch) return null;
  const day = parseInt(dayMatch[1], 10);
  const today = new Date(); today.setHours(0,0,0,0);
  let month = today.getMonth(), year = today.getFullYear(), foundMonth = false;
  for (const name in MONTH_NAME_MAP) {
    if (clean.includes(name)) { month = MONTH_NAME_MAP[name]; foundMonth = true; break; }
  }
  let date = new Date(year, month, day);
  if (!foundMonth) {
    const diffDays = Math.round((date - today) / 86400000);
    if (diffDays < -20) { month += 1; if (month > 11) { month = 0; year += 1; } date = new Date(year, month, day); }
  }
  return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
}

function parseBulkText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const result = [];
  let currentSubject = null;
  lines.forEach(line => {
    const bulletMatch = line.match(/^[*\-•]\s*(.+)$/);
    if (bulletMatch) {
      if (!currentSubject) return;
      const content = bulletMatch[1];
      const idx = content.lastIndexOf(' - ');
      let title, dateText;
      if (idx !== -1) { title = content.slice(0, idx).trim(); dateText = content.slice(idx+3).trim(); }
      else { title = content.trim(); dateText = ''; }
      result.push({ subject: currentSubject, title, dateStr: dateText ? parseSpanishDate(dateText) : null });
    } else {
      currentSubject = line.replace(/:$/, '').trim();
    }
  });
  return result;
}

async function submitBulkImport() {
  const text = document.getElementById('bulk-text').value;
  const parsed = parseBulkText(text);
  if (parsed.length === 0) { alert('No se reconoció ninguna tarea. Revisá el formato.'); return; }

  const subjectMap = {};
  subjects.forEach(s => subjectMap[s.name.toLowerCase()] = s.id);
  const neededNames = [...new Set(parsed.map(p => p.subject))];
  let colorOffset = subjects.length;
  for (const name of neededNames) {
    const key = name.toLowerCase();
    if (!subjectMap[key]) {
      const color = PALETTE[colorOffset % PALETTE.length].hex;
      colorOffset++;
      try {
        const ref = await db.collection('subjects').add({name, color});
        subjectMap[key] = ref.id;
      } catch (e) { console.error('Error creando materia', name, e); }
    }
  }

  let imported = 0, skipped = 0;
  for (const item of parsed) {
    if (!item.dateStr || !subjectMap[item.subject.toLowerCase()]) { skipped++; continue; }
    try {
      await db.collection('tasks').add({
        title: item.title, subjectId: subjectMap[item.subject.toLowerCase()], dueDate: item.dateStr, dueTime: '',
        priority: 'media', status: 'pendiente', reminderDays: null,
        checklist: [], notes: '', addedBy: myName, createdAt: Date.now()
      });
      imported++;
    } catch (e) { console.error('Error creando tarea', item.title, e); skipped++; }
  }

  closeBulkModal();
  alert(`Se importaron ${imported} tareas.${skipped ? ' ' + skipped + ' se omitieron.' : ''}`);
}

init();