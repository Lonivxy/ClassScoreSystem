const state = {
  students: [],
  token: '',
  defaultReasons: [],
  chart: null
};

const $studentList = document.getElementById('studentList');
const $toast = document.getElementById('toast');
const $loginModal = document.getElementById('loginModal');
const $passwordInput = document.getElementById('passwordInput');
const $loginBtn = document.getElementById('loginBtn');
const $loginError = document.getElementById('loginError');
const $openImportBtn = document.getElementById('openImportBtn');
const $importModal = document.getElementById('importModal');
const $closeImportBtn = document.getElementById('closeImportBtn');
const $importText = document.getElementById('importText');
const $importFile = document.getElementById('importFile');
const $clearImportBtn = document.getElementById('clearImportBtn');
const $submitImportBtn = document.getElementById('submitImportBtn');
const $importResult = document.getElementById('importResult');

function showToast(text) {
  $toast.textContent = text;
  $toast.classList.remove('hidden');
  setTimeout(() => $toast.classList.add('hidden'), 2500);
}

function levelText(student) {
  return `Lv.${student.level} | ${student.progressPercent.toFixed(3)}%`;
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token && state.token !== 'open-mode') {
    headers['x-admin-token'] = state.token;
  }
  return headers;
}

async function loginIfNeeded() {
  const config = await fetch('/api/config').then((r) => r.json());
  state.defaultReasons = config.defaultReasons || [];

  if (!config.passwordRequired) {
    state.token = 'open-mode';
    return;
  }

  $loginModal.classList.remove('hidden');
  $loginModal.classList.add('flex');

  return new Promise((resolve) => {
    $loginBtn.onclick = async () => {
      const password = $passwordInput.value;
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!res.ok) {
        $loginError.textContent = 'Wrong password, please retry.';
        return;
      }

      const data = await res.json();
      state.token = data.token;
      $loginModal.classList.add('hidden');
      $loginModal.classList.remove('flex');
      resolve();
    };
  });
}

async function fetchStudents() {
  const res = await fetch('/api/students');
  const data = await res.json();
  state.students = data.students || [];
  renderStudents();
  renderChart();
}

function renderStudents() {
  $studentList.innerHTML = '';

  state.students.forEach((student) => {
    const row = document.createElement('div');
    row.className = 'bg-white rounded-xl border border-slate-100 p-3 shadow-sm';

    const options = state.defaultReasons.map((reason) => `<option value="${reason}">${reason}</option>`).join('');

    row.innerHTML = `
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div>
          <h3 class="font-bold text-lg text-slate-700">${student.name}</h3>
          <p class="text-sm text-slate-500">Points: ${student.points} | ${levelText(student)}</p>
        </div>
        <div class="flex gap-2">
          <button data-id="${student.id}" data-delta="1" class="quick-btn bg-meadow text-white px-3 py-1.5 rounded-lg font-bold">+1</button>
          <button data-id="${student.id}" data-delta="2" class="quick-btn bg-skyedu text-white px-3 py-1.5 rounded-lg font-bold">+2</button>
          <button data-id="${student.id}" data-delta="-1" class="quick-btn bg-cherry text-white px-3 py-1.5 rounded-lg font-bold">-1</button>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
        <select class="reason-select border border-slate-200 rounded-lg px-2 py-2 md:col-span-2">
          ${options}
          <option value="Custom">Custom Reason</option>
        </select>
        <input type="text" class="custom-reason border border-slate-200 rounded-lg px-2 py-2" placeholder="Custom reason" />
        <div class="flex gap-2">
          <input type="number" class="custom-delta w-24 border border-slate-200 rounded-lg px-2 py-2" value="3" />
          <button data-id="${student.id}" class="custom-btn bg-sunrise text-white px-3 py-2 rounded-lg font-semibold">Apply</button>
        </div>
      </div>
      <input type="text" class="note-input mt-2 w-full border border-slate-200 rounded-lg px-2 py-2" placeholder="Optional note" />
    `;

    $studentList.appendChild(row);
  });

  bindActions();
}

function bindActions() {
  document.querySelectorAll('.quick-btn').forEach((btn) => {
    btn.onclick = () => {
      const card = btn.closest('.bg-white');
      const reason = resolveReason(card);
      const note = card.querySelector('.note-input').value.trim();
      changeScore(Number(btn.dataset.id), Number(btn.dataset.delta), reason, note);
    };
  });

  document.querySelectorAll('.custom-btn').forEach((btn) => {
    btn.onclick = () => {
      const card = btn.closest('.bg-white');
      const delta = Number(card.querySelector('.custom-delta').value);
      const reason = resolveReason(card);
      const note = card.querySelector('.note-input').value.trim();
      changeScore(Number(btn.dataset.id), delta, reason, note);
    };
  });
}

function resolveReason(card) {
  const reasonSelect = card.querySelector('.reason-select').value;
  const customReason = card.querySelector('.custom-reason').value.trim();

  if (reasonSelect === 'Custom') {
    return customReason || 'Custom Update';
  }

  return reasonSelect;
}

async function changeScore(studentId, delta, reason, note) {
  if (!Number.isInteger(delta) || delta === 0) {
    showToast('Please enter a valid integer delta.');
    return;
  }

  if (!reason) {
    showToast('Reason is required.');
    return;
  }

  const res = await fetch(`/api/students/${studentId}/score`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ delta, reason, note })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Update failed.' }));
    showToast(err.message || 'Update failed.');
    return;
  }

  const result = await res.json();
  showToast(`${result.student.name}: ${result.log.delta > 0 ? '+' : ''}${result.log.delta} (${result.log.reason})`);
  await fetchStudents();
}

function renderChart() {
  if (!state.chart) {
    state.chart = echarts.init(document.getElementById('chart'));
  }

  const names = state.students.map((s) => s.name);
  const scores = state.students.map((s) => s.points);

  state.chart.setOption({
    animationDuration: 550,
    grid: { top: 8, right: 10, bottom: 8, left: 70 },
    xAxis: { type: 'value', axisLabel: { color: '#334155' } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#334155', fontWeight: 700 } },
    series: [{
      type: 'bar',
      data: scores,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
          { offset: 0, color: '#22d3ee' },
          { offset: 1, color: '#1d4ed8' }
        ]),
        borderRadius: [8, 8, 8, 8]
      },
      label: { show: true, position: 'right', color: '#0f172a', fontWeight: 700 }
    }]
  });
}

function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}/ws`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'score_updated') {
      showToast(`Realtime: ${data.student.name} ${data.log.delta > 0 ? '+' : ''}${data.log.delta}`);
      fetchStudents();
    }
    if (data.type === 'students_imported') {
      showToast(`Imported ${data.importedCount}, skipped ${data.skippedCount}.`);
      fetchStudents();
    }
  };

  ws.onclose = () => setTimeout(connectWS, 2000);
}

function openImportModal() {
  $importResult.textContent = '';
  $importModal.classList.remove('hidden');
  $importModal.classList.add('flex');
}

function closeImportModal() {
  $importModal.classList.add('hidden');
  $importModal.classList.remove('flex');
}

async function submitImport() {
  const text = $importText.value;
  if (!text.trim()) {
    showToast('Please paste names or upload a txt file first.');
    return;
  }

  const res = await fetch('/api/students/import', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Import failed.' }));
    showToast(err.message || 'Import failed.');
    return;
  }

  const data = await res.json();
  $importResult.textContent = `Imported: ${data.importedCount}; Skipped: ${data.skippedCount}.`;
  showToast(`Import completed: +${data.importedCount}`);
  await fetchStudents();
}

async function readImportFile(file) {
  const text = await file.text();
  $importText.value = text;
}

window.addEventListener('resize', () => {
  if (state.chart) {
    state.chart.resize();
  }
});

$openImportBtn.onclick = openImportModal;
$closeImportBtn.onclick = closeImportModal;
$clearImportBtn.onclick = () => {
  $importText.value = '';
  $importFile.value = '';
  $importResult.textContent = '';
};
$submitImportBtn.onclick = submitImport;
$importFile.onchange = async () => {
  const file = $importFile.files && $importFile.files[0];
  if (!file) {
    return;
  }
  await readImportFile(file);
  $importResult.textContent = `Loaded file: ${file.name}`;
};
$importModal.addEventListener('click', (e) => {
  if (e.target === $importModal) {
    closeImportModal();
  }
});

(async () => {
  await loginIfNeeded();
  await fetchStudents();
  connectWS();
})();
