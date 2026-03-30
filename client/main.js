const state = {
  students: [],
  selectedStudentId: null,
  autoBackTimer: null,
  autoBackRemain: 15,
  rankingTicker: null
};

const $studentGrid = document.getElementById('studentGrid');
const $rankingList = document.getElementById('rankingList');
const $detailPanel = document.getElementById('detailPanel');
const $detailName = document.getElementById('detailName');
const $detailMeta = document.getElementById('detailMeta');
const $logList = document.getElementById('logList');
const $closeDetail = document.getElementById('closeDetail');
const $autoBackText = document.getElementById('autoBackText');
const $progressBar = document.getElementById('progressBar');
const $progressLabel = document.getElementById('progressLabel');
const $progressPct = document.getElementById('progressPct');
const $clock = document.getElementById('clock');
const $scorePopup = document.getElementById('scorePopup');
const $scorePopupCard = document.getElementById('scorePopupCard');
const $scorePopupText = document.getElementById('scorePopupText');
const $scorePopupReason = document.getElementById('scorePopupReason');

function renderClock() {
  const now = new Date();
  $clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function rankBadge(index) {
  if (index === 0) return 'bg-yellow-400 text-yellow-950';
  if (index === 1) return 'bg-slate-300 text-slate-800';
  if (index === 2) return 'bg-amber-700 text-amber-50';
  return 'bg-sky-100 text-sky-800';
}

async function fetchStudents() {
  const res = await fetch('/api/students');
  const data = await res.json();
  state.students = data.students || [];
  renderStudents();
  renderRanking();
}

function renderStudents() {
  $studentGrid.innerHTML = '';

  state.students.forEach((student) => {
    const card = document.createElement('button');
    card.className = 'text-left bg-white rounded-2xl border border-slate-100 p-3 shadow hover:shadow-md hover:-translate-y-0.5 transition';
    card.innerHTML = `
      <h3 class="text-xl font-bold text-boardBlue truncate">${student.name}</h3>
      <p class="text-slate-600">Points: ${student.points}</p>
      <p class="text-slate-500 text-sm">Level ${student.level} | ${student.progressPercent.toFixed(3)}%</p>
      <div class="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-boardMint to-boardOrange" style="width:${student.progressPercent}%"></div>
      </div>
    `;

    card.onclick = () => openDetail(student.id);
    $studentGrid.appendChild(card);
  });
}

function renderRanking() {
  $rankingList.innerHTML = '';

  state.students.forEach((student, index) => {
    const row = document.createElement('div');
    row.className = 'bg-white rounded-xl px-3 py-2 shadow border border-slate-100 flex items-center justify-between gap-3';
    row.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <span class="w-8 h-8 grid place-items-center rounded-full font-bold ${rankBadge(index)}">${index + 1}</span>
        <span class="font-bold text-lg truncate">${student.name}</span>
      </div>
      <div class="text-right">
        <p class="font-extrabold text-boardBlue text-xl">${student.points}</p>
        <p class="text-sm text-slate-500">Lv.${student.level}</p>
      </div>
    `;
    $rankingList.appendChild(row);
  });

  startRankingTicker();
}

function startRankingTicker() {
  if (state.rankingTicker) {
    cancelAnimationFrame(state.rankingTicker);
  }

  let last = performance.now();

  const loop = (now) => {
    if ($rankingList.scrollHeight > $rankingList.clientHeight) {
      const diff = now - last;
      if (diff > 40) {
        const nearBottom = $rankingList.scrollTop + $rankingList.clientHeight >= $rankingList.scrollHeight - 1;
        if (nearBottom) {
          $rankingList.scrollTop = 0;
        } else {
          $rankingList.scrollTop += 0.8;
        }
        last = now;
      }
    }

    state.rankingTicker = requestAnimationFrame(loop);
  };

  state.rankingTicker = requestAnimationFrame(loop);
}

async function openDetail(studentId) {
  state.selectedStudentId = studentId;
  const res = await fetch(`/api/students/${studentId}/logs`);
  const data = await res.json();

  $detailName.textContent = data.student.name;
  $detailMeta.textContent = `Points: ${data.student.points} | Level ${data.student.level}`;
  $progressLabel.textContent = `Level ${data.student.level} Progress`;
  $progressPct.textContent = `${data.student.progressPercent.toFixed(3)}%`;
  $progressBar.style.width = `${data.student.progressPercent}%`;

  $logList.innerHTML = '';
  if (!data.logs.length) {
    $logList.innerHTML = '<p class="text-slate-500">No records yet.</p>';
  } else {
    data.logs.forEach((log) => {
      const item = document.createElement('div');
      const plus = log.delta > 0 ? '+' : '';
      item.className = 'bg-slate-50 rounded-xl p-3 border border-slate-100';
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <p class="font-bold ${log.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${plus}${log.delta} | ${log.reason}</p>
          <p class="text-sm text-slate-500">${new Date(log.createdAt).toLocaleString()}</p>
        </div>
        ${log.note ? `<p class="text-slate-600 mt-1">${log.note}</p>` : ''}
      `;
      $logList.appendChild(item);
    });
  }

  $detailPanel.classList.remove('hidden');
  $detailPanel.classList.add('flex');
  startAutoBack();
}

function closeDetail() {
  state.selectedStudentId = null;
  stopAutoBack();
  $detailPanel.classList.add('hidden');
  $detailPanel.classList.remove('flex');
}

function startAutoBack() {
  stopAutoBack();
  state.autoBackRemain = 15;
  $autoBackText.textContent = `Auto back in ${state.autoBackRemain}s`;

  state.autoBackTimer = setInterval(() => {
    state.autoBackRemain -= 1;
    $autoBackText.textContent = `Auto back in ${state.autoBackRemain}s`;
    if (state.autoBackRemain <= 0) {
      closeDetail();
    }
  }, 1000);
}

function stopAutoBack() {
  if (state.autoBackTimer) {
    clearInterval(state.autoBackTimer);
    state.autoBackTimer = null;
  }
}

function showScorePopup(studentName, delta, reason) {
  const sign = delta > 0 ? '+' : '';
  $scorePopupText.textContent = `${studentName} ${sign}${delta}`;
  $scorePopupReason.textContent = reason || '';

  $scorePopup.classList.remove('hidden');
  $scorePopup.classList.add('flex');

  requestAnimationFrame(() => {
    $scorePopupCard.classList.remove('scale-90', 'opacity-0');
    $scorePopupCard.classList.add('scale-100', 'opacity-100');
  });

  setTimeout(() => {
    $scorePopupCard.classList.add('scale-90', 'opacity-0');
    setTimeout(() => {
      $scorePopup.classList.add('hidden');
      $scorePopup.classList.remove('flex');
    }, 250);
  }, 3000);
}

function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}/ws`);

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'score_updated') {
      if (data.log.delta > 0) {
        showScorePopup(data.student.name, data.log.delta, data.log.reason);
      }
      await fetchStudents();
      if (state.selectedStudentId === data.student.id) {
        openDetail(data.student.id);
      }
    }
  };

  ws.onclose = () => setTimeout(connectWS, 2000);
}

$closeDetail.onclick = closeDetail;
$detailPanel.addEventListener('click', (e) => {
  if (e.target === $detailPanel) {
    closeDetail();
  }
});

document.addEventListener('click', () => {
  if (!$detailPanel.classList.contains('hidden')) {
    startAutoBack();
  }
});

setInterval(renderClock, 1000);
setInterval(fetchStudents, 10000);

(async () => {
  renderClock();
  await fetchStudents();
  connectWS();
})();
