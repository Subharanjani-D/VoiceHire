const $ = s => document.querySelector(s), app = $('#app');
let S = { token: localStorage.vhT || '', user: JSON.parse(localStorage.vhU || 'null'), lang: localStorage.vhL || 'en-IN' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); };
const act = f => async (...a) => { try { await f(...a); } catch (e) { toast(e.message); } };
async function api(url, method = 'GET', body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.token }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
const stars = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
const wcard = w => `<a class="card wc" href="#/worker/${w.id}"><img src="${w.photo}" alt="${esc(w.name)}"><div><h3>${esc(w.name)} ${w.verified ? '✔' : ''}</h3><p class="mut">${w.service} · ${w.city}</p><p class="star">${stars(w.rating)} <small>${w.rating.toFixed(1)} (${w.count})</small></p><p><span class="tag ${w.available ? 'ok' : 'no'}">${w.available ? 'Available' : 'Busy'}</span> ₹${w.rate}/hr · ${w.exp} yrs</p></div></a>`;

function nav() {
  const h = location.hash || '#/';
  $('#nav').innerHTML = `<a class="brand" href="#/"><span class="logo">🎙</span><span><b>VOICEHIRE</b><small>VOICE-FIRST SERVICES</small></span></a>
  <nav>${[['#/', 'Home'], ['#/services', 'Services'], ['#/workers', 'Find Workers']].map(([l, t]) => `<a href="${l}" class="${h === l ? 'on' : ''}">${t}</a>`).join('')}<a href="#/voice" class="btn">🎙 Voice Request</a></nav>
  <div class="right"><select id="lang"><option value="en-IN">English</option><option value="ta-IN">தமிழ்</option></select>
  ${S.user ? `<a href="#/dashboard">👤 ${esc(S.user.name.split(' ')[0])}</a><a href="#" id="out">Logout</a>` : `<a href="#/login">Login</a><a href="#/register" class="btn">Register</a>`}</div>`;
  $('#lang').value = S.lang;
  $('#lang').onchange = e => { S.lang = localStorage.vhL = e.target.value; };
  const o = $('#out');
  if (o) o.onclick = e => { e.preventDefault(); S.token = ''; S.user = null; localStorage.removeItem('vhT'); localStorage.removeItem('vhU'); location.hash = '#/'; nav(); };
}

/* ---------- Voice ---------- */
function voiceBox() {
  return `<div class="card voice"><span class="pill">✨ Multilingual Voice AI Recognizer</span><h2>Tell us what you need</h2>
  <p class="mut">Click the microphone button and describe your service requirement naturally.</p>
  <button id="mic" class="mic">🎙</button><p id="vstat" class="mut">Tap to speak (${S.lang === 'ta-IN' ? 'Tamil' : 'English'})</p>
  <textarea id="vtxt" rows="3" placeholder="e.g. My ceiling fan is not working / என் வீட்டில் குழாய் கசிகிறது"></textarea>
  <button id="vgo" class="btn big">Find Workers</button><div id="vres"></div></div>`;
}
function voiceInit() {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const go = act(async () => {
    const t = $('#vtxt').value.trim(); if (!t) return toast('Speak or type your requirement first');
    const d = await api('/voice-parse', 'POST', { text: t });
    $('#vres').innerHTML = d.service
      ? `<p>Detected service: <b>${d.service}</b></p><div class="grid">${d.workers.slice(0, 2).map(wcard).join('')}</div><p><a class="btn" href="#/workers?service=${encodeURIComponent(d.service)}">See all ${d.service}s</a></p>`
      : '<p class="mut">Could not detect a service. Try words like fan, pipe leak, paint, AC, bike...</p>';
  });
  $('#mic').onclick = () => {
    if (!R) return toast('Voice input needs Chrome/Edge. You can type instead.');
    const r = new R(); r.lang = S.lang;
    r.onstart = () => { $('#mic').classList.add('rec'); $('#vstat').textContent = 'Listening...'; };
    r.onend = () => { $('#mic').classList.remove('rec'); $('#vstat').textContent = 'Tap to speak'; };
    r.onresult = e => { $('#vtxt').value = e.results[0][0].transcript; go(); };
    r.onerror = () => toast('Could not hear you. Please try again.');
    r.start();
  };
  $('#vgo').onclick = go;
}

/* ---------- Pages ---------- */
function home() {
  app.innerHTML = `<section class="hero"><span class="pill">🎙 Connecting Customers and Skilled Workers Through Voice</span>
  <h1>Find the Right Worker. Just Say What You Need.</h1><p class="lead">VoiceHire connects you with skilled local workers through simple voice-based service requests.</p>
  <div class="row"><a class="btn dark big" href="#/workers">🔍 Find a Worker</a><a class="btn big" href="#/voice">🎙 Speak Your Requirement</a></div></section>${voiceBox()}`;
  voiceInit();
}
function voice() { app.innerHTML = voiceBox(); voiceInit(); }

async function services() {
  const s = await api('/services');
  app.innerHTML = `<h1 class="c">Blue-Collar Service Categories</h1><p class="lead">Find skilled professionals across ${s.length} dedicated trade categories with verified background checks.</p>
  <input id="q" class="search" placeholder="🔍 Search service name or task..."><div class="grid4" id="sg"></div>`;
  const draw = () => { const q = $('#q').value.toLowerCase(); $('#sg').innerHTML = s.filter(x => (x.name + x.desc).toLowerCase().includes(q)).map(x => `<a class="card" href="#/workers?service=${encodeURIComponent(x.name)}"><div class="ico">${x.icon}</div><h3>${x.name}</h3><p class="mut">${x.desc}</p><span class="pill">${x.count} Workers Available</span></a>`).join(''); };
  $('#q').oninput = draw; draw();
}
async function workers() {
  const sv = new URLSearchParams(location.hash.split('?')[1] || '').get('service') || '';
  const list = await api('/workers?service=' + encodeURIComponent(sv));
  app.innerHTML = `<h1 class="c">${esc(sv) || 'All'} Workers</h1><input id="q" class="search" placeholder="🔍 Search by name, skill or city..."><div class="grid" id="wl"></div>`;
  const draw = () => { const q = $('#q').value.toLowerCase(); $('#wl').innerHTML = list.filter(w => (w.name + w.skills.join() + w.city).toLowerCase().includes(q)).map(wcard).join('') || '<p class="mut">No workers found.</p>'; };
  $('#q').oninput = draw; draw();
}
async function workerPage(id) {
  const w = await api('/workers/' + id);
  app.innerHTML = `<div class="card prof"><img src="${w.photo}" alt=""><div><h1>${esc(w.name)} ${w.verified ? '<span class="tag ok">Verified</span>' : ''}</h1>
  <p class="mut">${w.service} · ${esc(w.city)} · ${w.exp} yrs experience · ₹${w.rate}/hr</p><p class="star">${stars(w.rating)} ${w.rating.toFixed(1)} (${w.count} reviews)</p>
  <p>${w.skills.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</p><p><span class="tag ${w.available ? 'ok' : 'no'}">${w.available ? 'Available now' : 'Currently busy'}</span></p></div></div>
  <div class="card"><h2>Reviews</h2>${w.reviews.map(r => `<p><span class="star">${stars(r.stars)}</span> ${esc(r.text)} <small class="mut">— ${esc(r.by)}</small></p>`).join('') || '<p class="mut">No reviews yet.</p>'}</div>
  ${S.user?.role === 'customer' ? `<div class="card"><h2>Send Job Request</h2><textarea id="d" rows="3" placeholder="Describe the work..."></textarea><input id="dt" type="date"><input id="ad" placeholder="Address"><button id="send" class="btn big">Send Request</button></div>`
    : `<p class="mut c">${S.user ? 'Only customers can send job requests.' : '<a href="#/login"><u>Login</u></a> or <a href="#/register"><u>register</u></a> to send a job request.'}</p>`}`;
  const b = $('#send');
  if (b) b.onclick = act(async () => { await api('/requests', 'POST', { workerId: id, description: $('#d').value, date: $('#dt').value, address: $('#ad').value }); toast('Request sent!'); location.hash = '#/dashboard'; });
}

/* ---------- Auth ---------- */
async function doLogin(email, password, role) {
  const d = await api('/login', 'POST', { email, password, role });
  S.token = localStorage.vhT = d.token; S.user = d.user; localStorage.vhU = JSON.stringify(d.user);
  location.hash = '#/dashboard'; nav();
}
function login() {
  let role = 'customer';
  const demo = [['Customer Demo: Anand Sharma', 'anand@example.com', 'customer'], ['Worker Demo: Ravi Kumar (Electrician)', 'ravi@voicehire.in', 'worker'], ['Admin Demo: Platform Manager', 'admin@example.com', 'admin']];
  app.innerHTML = `<div class="card auth"><div class="ico c">🎙</div><h2 class="c">Login to VoiceHire</h2><p class="mut c">Select your account type or use 1-click academic demo logins below.</p>
  <div class="tabs">${['customer', 'worker', 'admin'].map(r => `<button data-r="${r}" class="${r === role ? 'on' : ''}">${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}</div>
  <label>Email Address</label><input id="em" placeholder="anand@example.com"><label>Password</label><input id="pw" type="password" placeholder="password123">
  <button id="go" class="btn big w">Login as customer</button><h4 class="c">⚡ QUICK 1-CLICK ACADEMIC DEMO LOGIN</h4>
  ${demo.map((d, i) => `<button class="demo" data-i="${i}">${d[0]} <small>${d[2][0].toUpperCase() + d[2].slice(1)} →</small></button>`).join('')}</div>`;
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { role = b.dataset.r; document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); $('#go').textContent = 'Login as ' + role; });
  $('#go').onclick = act(() => doLogin($('#em').value, $('#pw').value, role));
  document.querySelectorAll('.demo').forEach(b => b.onclick = act(() => { const d = demo[b.dataset.i]; return doLogin(d[1], 'password123', d[2]); }));
}
async function register() {
  const sv = await api('/services');
  app.innerHTML = `<div class="card auth"><h2 class="c">Create your VoiceHire account</h2>
  <select id="role"><option value="customer">I need workers (Customer)</option><option value="worker">I am a worker (Job Seeker)</option></select>
  <input id="nm" placeholder="Full name"><input id="em" placeholder="Email"><input id="pw" type="password" placeholder="Password (min 6 chars)">
  <div id="wx" style="display:none"><select id="gn"><option value="m">Male</option><option value="f">Female</option></select><select id="sv">${sv.map(s => `<option>${s.name}</option>`).join('')}</select>
  <input id="sk" placeholder="Skills (comma separated)"><input id="ex" type="number" placeholder="Years of experience"><input id="ct" placeholder="City"><input id="rt" type="number" placeholder="Rate per hour (₹)"></div>
  <button id="go" class="btn big w">Register</button></div>`;
  $('#role').onchange = e => $('#wx').style.display = e.target.value === 'worker' ? 'block' : 'none';
  $('#go').onclick = act(async () => {
    const role = $('#role').value;
    await api('/register', 'POST', { role, name: $('#nm').value, email: $('#em').value, password: $('#pw').value, gender: $('#gn').value, service: $('#sv').value, skills: $('#sk').value, exp: $('#ex').value, city: $('#ct').value, rate: $('#rt').value });
    toast(role === 'worker' ? 'Registered! Admin will verify your profile.' : 'Registered! Please login.'); location.hash = '#/login';
  });
}

/* ---------- Dashboards ---------- */
function reqCard(r) {
  const w = S.user.role === 'worker', b = [];
  if (w) { if (r.status === 'pending') b.push(['accept', 'Accept'], ['reject', 'Reject']); if (r.status === 'accepted') b.push(['start', 'Start Job']); if (r.status === 'in_progress') b.push(['complete', 'Mark Completed']); }
  else { if (r.status === 'completed') b.push(['pay', `Pay ₹${r.amount}`]); if (r.status === 'paid' && !r.rated) b.push(['rate', 'Rate & Review']); }
  if (['accepted', 'in_progress', 'completed', 'paid'].includes(r.status)) b.push(['chat', '💬 Chat']);
  b.push(['report', 'Report']);
  return `<div class="card req"><div><h3>${esc(r.service)} — ${esc(w ? r.customerName : r.workerName)}</h3><p>${esc(r.description)}</p><p class="mut">${esc(r.date)} ${esc(r.address)}</p></div>
  <div><span class="tag st-${r.status}">${r.status.replace('_', ' ')}</span><div class="acts">${b.map(([a, t]) => `<button class="btn dark sm" data-a="${a}" data-id="${r.id}">${t}</button>`).join('')}</div></div></div>`;
}
async function dash() {
  if (!S.user) return location.hash = '#/login';
  if (S.user.role === 'admin') return adminView();
  const rs = await api('/requests'); let extra = '';
  if (S.user.role === 'worker') {
    const me = await api('/me/worker');
    extra = `<div class="card req"><span>Availability: <span class="tag ${me.available ? 'ok' : 'no'}">${me.available ? 'Available' : 'Busy'}</span> ${me.verified ? '' : '<span class="tag no">Awaiting admin verification</span>'}</span><button class="btn dark sm" id="av">Toggle availability</button></div>`;
  }
  app.innerHTML = `<h1>${S.user.role === 'worker' ? 'Worker' : 'Customer'} Dashboard</h1>${extra}${S.user.role === 'customer' ? '<a class="btn" href="#/voice">🎙 New Voice Request</a>' : ''}<div id="rl">${rs.map(reqCard).join('') || '<p class="mut">No job requests yet.</p>'}</div>`;
  const av = $('#av'); if (av) av.onclick = act(async () => { await api('/me/worker/toggle', 'POST'); dash(); });
  $('#rl').onclick = act(async e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const { a, id } = b.dataset;
    if (a === 'chat') return location.hash = '#/chat/' + id;
    if (a === 'report') { const t = prompt('Describe your complaint'); if (t) { await api('/complaints', 'POST', { requestId: id, text: t }); toast('Complaint sent to admin'); } return; }
    const body = { action: a };
    if (a === 'complete') body.hours = +prompt('Hours worked?', '2') || 2;
    if (a === 'rate') { body.stars = +prompt('Rating (1-5)', '5'); body.text = prompt('Write a short review') || ''; }
    await api('/requests/' + id, 'PATCH', body); toast('Updated'); dash();
  });
}
async function adminView() {
  const d = await api('/admin/overview');
  app.innerHTML = `<h1>Admin Panel</h1><div class="stats"><div class="card"><b>${d.users.length}</b><p>Users</p></div><div class="card"><b>${d.workers.filter(w => !w.verified).length}</b><p>Pending workers</p></div><div class="card"><b>${d.requests}</b><p>Job requests</p></div><div class="card"><b>${d.complaints.filter(c => c.status === 'open').length}</b><p>Open complaints</p></div></div>
  <h2>Workers</h2>${d.workers.map(w => `<div class="card req"><span><img src="${w.photo}" width="36" style="border-radius:50%;vertical-align:middle"> <b>${esc(w.name)}</b> · ${w.service} <span class="tag ${w.verified ? 'ok' : 'no'}">${w.verified ? 'Verified' : 'Pending'}</span></span><button class="btn dark sm" data-w="${w.id}">${w.verified ? 'Revoke' : 'Verify'}</button></div>`).join('')}
  <h2>Users</h2>${d.users.filter(u => u.role === 'customer').map(u => `<div class="card req"><span>${esc(u.name)} · ${esc(u.email)} ${u.blocked ? '<span class="tag no">Blocked</span>' : ''}</span><button class="btn dark sm" data-u="${u.id}">${u.blocked ? 'Unblock' : 'Block'}</button></div>`).join('')}
  <h2>Complaints</h2>${d.complaints.map(c => `<div class="card req"><span>${esc(c.by)}: ${esc(c.text)} <span class="tag st-${c.status === 'open' ? 'pending' : 'paid'}">${c.status}</span></span>${c.status === 'open' ? `<button class="btn dark sm" data-c="${c.id}">Resolve</button>` : ''}</div>`).join('') || '<p class="mut">No complaints.</p>'}`;
  app.onclick = act(async e => {
    const b = e.target.closest('button[data-w],button[data-u],button[data-c]'); if (!b) return;
    if (b.dataset.w) await api('/admin/workers/' + b.dataset.w, 'PATCH');
    if (b.dataset.u) await api('/admin/users/' + b.dataset.u, 'PATCH');
    if (b.dataset.c) await api('/admin/complaints/' + b.dataset.c, 'PATCH');
    adminView();
  });
}
async function chat(id) {
  const m = await api('/messages/' + id);
  app.innerHTML = `<h1>Job Chat</h1><div class="card chat">${m.map(x => `<p class="${x.from === S.user.id ? 'me' : ''}"><small class="mut">${esc(x.name)}</small><br>${esc(x.text)}</p>`).join('') || '<p class="mut">Say hello!</p>'}</div>
  <div class="row"><input id="mt" placeholder="Type a message"><button class="btn" id="ms">Send</button></div><a href="#/dashboard" class="mut">← Back to dashboard</a>`;
  $('#ms').onclick = act(async () => { await api('/messages/' + id, 'POST', { text: $('#mt').value }); chat(id); });
}

/* ---------- Router ---------- */
const routes = [[/^#\/services$/, services], [/^#\/workers(\?.*)?$/, workers], [/^#\/worker\/(\w+)$/, workerPage], [/^#\/voice$/, voice], [/^#\/login$/, login], [/^#\/register$/, register], [/^#\/dashboard$/, dash], [/^#\/chat\/(\w+)$/, chat]];
async function route() {
  nav(); app.onclick = null; const h = location.hash || '#/';
  for (const [re, fn] of routes) { const m = h.match(re); if (m) { try { return await fn(m[1]); } catch (e) { app.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; } } }
  home();
}
window.addEventListener('hashchange', route); route();
