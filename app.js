const canConnectBank = ['127.0.0.1', 'localhost'].includes(location.hostname);
const storageKey = 'flux-gastos';
if (new URLSearchParams(location.search).get('resetFluxLocal') === '1') {
  localStorage.removeItem(storageKey);
  localStorage.removeItem('claro-gastos');
  history.replaceState(null, '', location.pathname);
}
let manualData = [];
try {
  const saved = localStorage.getItem(storageKey) || localStorage.getItem('claro-gastos');
  const parsed = saved ? JSON.parse(saved) : [];
  manualData = Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
} catch {
  manualData = [];
}

let bankItems = [];
let monthlyItems = [];
let live = false;
let connected = false;
let selected = 'Todos';
const month = new Date();
month.setDate(1);
const types = ['Todos', 'Suscripciones', 'Recibos', 'Recurrentes'];
const colors = { Suscripciones: '#d7785d', Recibos: '#6385b0', Recurrentes: '#c59d4c' };
const euro = amount => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(amount) || 0);

function currentData() {
  return live ? bankItems.concat(manualData.filter(item => item.manual)) : manualData;
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(manualData));
  localStorage.removeItem('claro-gastos');
}

function monthName(date) {
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(date);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function render() {
  const data = currentData();
  document.getElementById('monthLabel').textContent = monthName(month);
  const totals = Object.fromEntries(types.slice(1).map(type => [
    type,
    data.filter(item => item.type === type).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  ]));
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const countLabel = data.length ? `${data.length} pagos previstos en ${monthName(month)}` : 'Aún no hay gastos';

  document.getElementById('cards').innerHTML = `<div class="card total"><div class="label">Gasto mensual estimado</div><div class="amount">${euro(total)}</div><div class="subline">${countLabel}</div></div>` +
    types.slice(1).map(type => `<div class="card"><div class="cardhead"><div class="label">${type}</div><i class="dot" style="background:${colors[type]}"></i></div><div class="amount">${euro(totals[type])}</div><div class="subline">${total ? Math.round(totals[type] / total * 100) : 0}% del total mensual</div></div>`).join('');

  document.getElementById('keys').innerHTML = types.slice(1).map(type =>
    `<div class="key"><i style="background:${colors[type]}"></i><span>${type}</span><b>${total ? Math.round(totals[type] / total * 100) : 0}%</b></div>`
  ).join('');
  document.getElementById('donutTotal').innerHTML = `${euro(total)}<small>al mes</small>`;
  if (total) {
    const subscriptions = totals.Suscripciones / total * 100;
    const bills = (totals.Suscripciones + totals.Recibos) / total * 100;
    document.querySelector('.donut').style.background = `conic-gradient(${colors.Suscripciones} 0 ${subscriptions}%,${colors.Recibos} ${subscriptions}% ${bills}%,${colors.Recurrentes} ${bills}% 100%)`;
  } else {
    document.querySelector('.donut').style.background = '#1a2a34';
  }

  const history = live ? monthlyItems.map(item => ({ label: item.month, value: item.total })) : [];
  const bars = document.getElementById('bars');
  if (history.length) {
    const max = Math.max(1, ...history.map(item => Number(item.value) || 0));
    bars.innerHTML = history.map((item, index) => {
      const labelDate = new Date(`${item.label}-01T12:00:00`);
      const label = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(labelDate).replace('.', '');
      const height = Math.max(7, (Number(item.value) || 0) / max * 90);
      return `<div class="barcol"><span class="barval">${euro(item.value)}</span><div class="bar ${index === history.length - 1 ? 'current' : ''}" style="height:${height}%"></div><span>${label}</span></div>`;
    }).join('');
  } else {
    bars.innerHTML = '<div class="empty chart-empty">Aún no hay historial mensual para comparar.</div>';
  }
  document.querySelector('.legend').style.display = history.length ? 'flex' : 'none';
  document.getElementById('trend').textContent = live ? 'Gasto real importado' : 'Sin historial todavía';

  const tabs = document.getElementById('tabs');
  tabs.innerHTML = types.map(type => `<button class="tab ${selected === type ? 'active' : ''}" data-tab="${type}">${type}${type === 'Todos' ? ` (${data.length})` : ''}</button>`).join('');
  const shown = data.filter(item => selected === 'Todos' || item.type === selected)
    .sort((a, b) => (Number(a.date) || 0) - (Number(b.date) || 0));
  document.getElementById('rows').innerHTML = shown.length ? shown.map(item => {
    const occurrences = Math.max(0, Number(item.occurrences) || 0);
    const dateLabel = occurrences ? `${occurrences} cargos` : new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(month);
    return `<div class="row"><div class="merchant"><div class="icon">${escapeHtml(item.icon || '€')}</div><span>${escapeHtml(item.name || 'Gasto')}</span></div><div class="category">${escapeHtml(item.type || 'Recurrentes')}</div><div class="date">Día ${String(Number(item.date) || 1).padStart(2, '0')} · ${dateLabel}</div><div class="price">${euro(item.amount)}</div><button class="more" title="Eliminar gasto" aria-label="Eliminar ${escapeHtml(item.name || 'gasto')}" data-delete="${manualData.indexOf(item)}" ${item.manual ? '' : 'style="visibility:hidden"'}>⋯</button></div>`;
  }).join('') : `<div class="empty">${live ? 'No se han detectado pagos periódicos repetidos todavía.' : 'Aún no hay gastos. Conecta tu banco o añade un gasto manualmente.'}</div>`;
  document.getElementById('count').textContent = `${shown.length} ${shown.length === 1 ? 'movimiento previsto' : 'movimientos previstos'}`;
  document.getElementById('footerSum').textContent = `Total: ${euro(shown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}`;

  document.querySelectorAll('[data-tab]').forEach(button => {
    button.onclick = () => { selected = button.dataset.tab; render(); };
  });
  document.querySelectorAll('[data-delete]').forEach(button => {
    button.onclick = () => {
      const index = Number(button.dataset.delete);
      if (index >= 0) { manualData.splice(index, 1); save(); render(); }
    };
  });

  document.getElementById('realnote').textContent = live
    ? 'Estimaciones calculadas con cargos similares detectados en los últimos seis meses. Revisa las categorías y los importes.'
    : canConnectBank
      ? 'Los gastos aparecerán cuando conectes una cuenta o añadas un gasto manualmente.'
      : 'Tus datos se guardan localmente en este dispositivo; no se envían a un servidor.';
  document.getElementById('tableTitle').textContent = live ? 'Pagos periódicos detectados' : 'Mis gastos';
  document.getElementById('tableSubtitle').textContent = live ? 'Promedio por comercio a partir de cargos recientes' : 'Suscripciones, recibos y gastos recurrentes';
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  let result = {};
  try { result = await response.json(); } catch { /* report a useful status below */ }
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación');
  return result;
}

async function loadBanks() {
  const response = await jsonFetch('/api/banks');
  const select = document.getElementById('bankSelect');
  const button = document.getElementById('bankBtn');
  select.replaceChildren(new Option('Elige tu banco…', ''));
  for (const bank of response.items) select.add(new Option(bank.name, bank.name));
  select.style.display = response.items.length ? 'inline-block' : 'none';
  button.disabled = !response.items.length;
  if (!response.items.length) document.getElementById('bankmsg').textContent = 'Enable Banking no ofrece bancos españoles disponibles ahora mismo.';
}

async function loadBank() {
  const bankSelect = document.getElementById('bankSelect');
  const bankBtn = document.getElementById('bankBtn');
  const configBtn = document.getElementById('configBtn');
  if (!canConnectBank) {
    document.getElementById('banktitle').textContent = 'Conexión bancaria desde la app de escritorio';
    document.getElementById('bankdetail').textContent = 'La versión web y móvil guarda los gastos en este dispositivo. Conecta el banco desde Flux para Debian, Windows o macOS.';
    bankSelect.style.display = 'none';
    configBtn.style.display = 'none';
    bankBtn.disabled = true;
    bankBtn.style.display = 'inline-block';
    bankBtn.title = 'Usa Flux de escritorio para conectar tu banco';
    document.getElementById('bankmsg').textContent = 'Modo privado · datos guardados en este dispositivo';
    render();
    return;
  }

  try {
    const status = await jsonFetch('/api/status');
    connected = status.connected;
    document.getElementById('bankbar').classList.remove('error');
    document.getElementById('banktitle').textContent = connected ? `Conectado a ${status.bankName || 'tu banco'}` : 'Conecta tu banco';
    document.getElementById('bankdetail').textContent = connected
      ? `${status.transactionCount} movimientos guardados en este dispositivo${status.expires ? ` · consentimiento hasta ${new Date(status.expires).toLocaleDateString('es-ES')}` : ''}`
      : 'Elige un banco español y autoriza solo el acceso de consulta.';
    bankBtn.disabled = !status.configured;
    bankBtn.style.display = status.configured && !connected ? 'inline-block' : 'none';
    bankBtn.title = '';
    configBtn.style.display = connected ? 'none' : 'inline-block';
    configBtn.textContent = status.configured ? 'Cambiar credenciales' : 'Configurar acceso';
    bankSelect.style.display = 'none';
    document.getElementById('syncBtn').style.display = connected ? 'inline-block' : 'none';
    document.getElementById('disconnectBtn').style.display = connected ? 'inline-block' : 'none';
    document.getElementById('bankmsg').textContent = '';
    if (connected) {
      const [recurring, monthly] = await Promise.all([jsonFetch('/api/recurring'), jsonFetch('/api/monthly')]);
      bankItems = recurring.items;
      monthlyItems = monthly.items;
      live = true;
    } else if (status.configured) {
      await loadBanks();
    } else {
      document.getElementById('bankmsg').textContent = 'Configura tu aplicación personal de Enable Banking para continuar.';
      document.getElementById('bankbar').classList.add('error');
    }
    render();
  } catch (error) {
    document.getElementById('bankmsg').textContent = error.message;
    document.getElementById('syncBtn').style.display = 'none';
    document.getElementById('bankbar').classList.add('error');
  }
}

async function connectBank() {
  if (!canConnectBank) return;
  const name = document.getElementById('bankSelect').value;
  if (!name) { document.getElementById('bankmsg').textContent = 'Elige primero tu banco.'; return; }
  try {
    document.getElementById('bankmsg').textContent = 'Preparando autorización…';
    const result = await jsonFetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    window.location.href = result.url;
  } catch (error) {
    document.getElementById('bankbar').classList.add('error');
    document.getElementById('bankmsg').textContent = error.message;
  }
}

async function syncBank() {
  try {
    document.getElementById('bankmsg').textContent = 'Sincronizando…';
    const result = await jsonFetch('/api/sync', { method: 'POST' });
    document.getElementById('bankmsg').textContent = `${result.count} movimientos actualizados`;
    await loadBank();
  } catch (error) {
    document.getElementById('bankmsg').textContent = error.message;
  }
}

async function disconnectBank() {
  if (!confirm('¿Desconectar el banco y borrar de este dispositivo los movimientos importados?')) return;
  try {
    document.getElementById('bankmsg').textContent = 'Revocando acceso…';
    await jsonFetch('/api/disconnect', { method: 'POST' });
    bankItems = [];
    monthlyItems = [];
    live = false;
    document.getElementById('bankmsg').textContent = 'Cuenta desconectada';
    await loadBank();
  } catch (error) {
    document.getElementById('bankmsg').textContent = error.message;
  }
}

document.getElementById('prev').onclick = () => { month.setMonth(month.getMonth() - 1); render(); };
document.getElementById('next').onclick = () => { month.setMonth(month.getMonth() + 1); render(); };
function openModal() { document.getElementById('overlay').style.display = 'flex'; document.getElementById('name').focus(); }
function closeModal() { document.getElementById('overlay').style.display = 'none'; }
document.getElementById('addBtn').onclick = openModal;
document.getElementById('tableAdd').onclick = openModal;
document.getElementById('cancel').onclick = closeModal;
document.getElementById('overlay').onclick = event => { if (event.target.id === 'overlay') closeModal(); };
document.getElementById('form').onsubmit = event => {
  event.preventDefault();
  const date = new Date(`${document.getElementById('date').value}T12:00:00`);
  const name = document.getElementById('name').value.trim();
  manualData.push({ name, amount: Number(document.getElementById('amount').value), type: document.getElementById('type').value, date: date.getDate(), icon: '↻', manual: true });
  save(); closeModal(); event.target.reset(); selected = 'Todos'; render();
};
document.getElementById('exportBtn').onclick = () => {
  const safeCell = value => {
    const text = String(value ?? '');
    const protectedText = /^[\s]*[=+@\-]/.test(text) ? `'${text}` : text;
    return `"${protectedText.replaceAll('"', '""')}"`;
  };
  const csv = [
    ['Nombre', 'Categoría', 'Importe mensual', 'Fecha', 'Repeticiones'].map(safeCell).join(','),
    ...currentData().map(item => [item.name, item.type, Number(item.amount).toFixed(2), item.date, item.occurrences || 1].map(safeCell).join(','))
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'gastos-mensuales.csv'; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

document.getElementById('configBtn').onclick = () => {
  document.getElementById('configOverlay').style.display = 'flex';
  document.getElementById('applicationId').focus();
};
document.getElementById('configCancel').onclick = () => {
  document.getElementById('configOverlay').style.display = 'none';
  document.getElementById('configMsg').textContent = '';
};
document.getElementById('configOverlay').onclick = event => {
  if (event.target.id === 'configOverlay') document.getElementById('configOverlay').style.display = 'none';
};
document.getElementById('configForm').onsubmit = async event => {
  event.preventDefault();
  const file = document.getElementById('privateKey').files[0];
  if (!file) return;
  try {
    document.getElementById('configMsg').textContent = 'Guardando clave localmente…';
    const privateKey = btoa(await file.text());
    await jsonFetch('/api/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: document.getElementById('applicationId').value.trim(), privateKey })
    });
    event.target.reset();
    document.getElementById('configOverlay').style.display = 'none';
    document.getElementById('configMsg').textContent = '';
    await loadBank();
  } catch (error) {
    document.getElementById('configMsg').textContent = error.message;
  }
};
document.getElementById('bankBtn').onclick = connectBank;
document.getElementById('syncBtn').onclick = syncBank;
document.getElementById('disconnectBtn').onclick = disconnectBank;

let installPrompt = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; installBtn.style.display = 'inline-block';
});
installBtn.onclick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt(); await installPrompt.userChoice;
  installPrompt = null; installBtn.style.display = 'none';
};
window.addEventListener('appinstalled', () => { installBtn.style.display = 'none'; installPrompt = null; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./service-worker.js').catch(() => {});
render();
loadBank();
