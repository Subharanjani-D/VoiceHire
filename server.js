const express = require('express'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB = path.join(__dirname, 'data', 'db.json');
const hash = p => crypto.createHash('sha256').update('voicehire' + p).digest('hex');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const sessions = {};
let db;
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 1));

// name, icon, description, keywords (English + Tamil), [male, female]
const SERVICES = [
  ['Electrician', '⚡', 'Ceiling fans, wiring, light fixtures, switchboards, MCB, short circuits, invertors.', 'electric,fan,wiring,light,switch,current,power,மின்,விளக்கு,எலக்ட்ரீசியன்', ['Ravi Kumar', 'Subha Lakshmi']],
  ['Plumber', '💧', 'Tap repair, pipe leaks, bathroom fittings, water tank cleaning, drainage blockage.', 'plumb,pipe,tap,leak,water,drain,tank,குழாய்,தண்ணீர்,பிளம்பர்', ['Murugan', 'Ragavi']],
  ['Carpenter', '🔨', 'Furniture assembly, door lock repair, cabinet making, woodwork, bed repair.', 'carpent,wood,furniture,door,cabinet,bed,table,தச்சர்,மரம்,கதவு', ['Selvam', 'Ilamathi']],
  ['Painter', '🖌️', 'Full house painting, accent walls, waterproofing, exterior painting, patch touchups.', 'paint,wall,color,colour,waterproof,பெயிண்ட்,சுவர்,வண்ணம்', ['Karthikeyan', 'Sasikala']],
  ['Cleaner', '✨', 'Deep house cleaning, sofa/carpet cleaning, bathroom and kitchen cleaning.', 'clean,sofa,carpet,wash,dust,சுத்தம்,துடை', ['Arumugam', 'Sri Devi']],
  ['Mechanic', '🔧', 'Two-wheeler repair, car battery jumpstart, puncture, engine service.', 'mechanic,bike,car,vehicle,scooter,puncture,engine,மெக்கானிக்,வண்டி,பைக்', ['Senthil', 'Tamilselvi']],
  ['AC Technician', '❄️', 'AC servicing, gas refilling, cooling issue fix, installation.', 'ac,air condition,cooling,gas,ஏசி,குளிர்', ['Vignesh', 'Kaviya']],
  ['Appliance Repair', '📺', 'Washing machine repair, refrigerator fix, TV, mixer and grinder repair.', 'washing,fridge,refrigerator,tv,mixer,grinder,appliance,oven,வாஷிங்,பிரிட்ஜ்', ['Bharathi Raja', 'Meenakshi']],
  ['Mason', '🧱', 'Brick work, plastering, tiling, flooring, wall construction and repair.', 'mason,brick,tile,plaster,floor,cement,construction,கொத்தனார்,செங்கல்', ['Palani', 'Thenmozhi']],
  ['Welder', '🔥', 'Gate and grill fabrication, metal repair, roofing frames, iron work.', 'weld,gate,grill,iron,metal,steel,வெல்டிங்,இரும்பு', ['Kannan', 'Yazhini']],
  ['Gardener', '🌿', 'Garden maintenance, plant care, lawn cutting, terrace garden setup.', 'garden,plant,lawn,tree,grass,தோட்டம்,செடி,மரம் வெட்டு', ['Muthu', 'Poongodi']],
  ['Driver', '🚗', 'Local and outstation drivers, acting driver, goods vehicle drivers.', 'driver,drive,taxi,cab,lorry,ஓட்டுநர்,டிரைவர்', ['Gowtham', 'Nandhini']]
];
const CITIES = ['Chidambaram', 'Cuddalore', 'Chennai', 'Madurai', 'Coimbatore', 'Trichy', 'Salem', 'Pondicherry'];
const SKILLS = {
  Electrician: ['Wiring', 'Fan repair', 'MCB'], Plumber: ['Pipe leaks', 'Tap repair', 'Tank cleaning'],
  Carpenter: ['Furniture', 'Door repair', 'Cabinets'], Painter: ['Interior', 'Exterior', 'Waterproofing'],
  Cleaner: ['Deep cleaning', 'Sofa cleaning', 'Kitchen'], Mechanic: ['Two-wheeler', 'Car battery', 'Puncture'],
  'AC Technician': ['AC service', 'Gas refill', 'Installation'], 'Appliance Repair': ['Washing machine', 'Fridge', 'TV'],
  Mason: ['Plastering', 'Tiling', 'Brick work'], Welder: ['Gates', 'Grills', 'Metal repair'],
  Gardener: ['Lawn care', 'Plant care', 'Terrace garden'], Driver: ['Local trips', 'Outstation', 'Acting driver']
};

function seed() {
  db = { users: [], workers: [], requests: [], messages: [], complaints: [] };
  const add = (name, email, role) => { const u = { id: uid(), name, email, pass: hash('password123'), role, blocked: false }; db.users.push(u); return u; };
  add('Anand Sharma', 'anand@example.com', 'customer');
  add('Platform Manager', 'admin@example.com', 'admin');
  let n = 0;
  SERVICES.forEach(([service, , , , pair], si) => {
    pair.forEach((name, gi) => {
      const g = gi === 0 ? 'm' : 'f', u = add(name, name.split(' ')[0].toLowerCase() + '@voicehire.in', 'worker'); n++;
      db.workers.push({
        id: 'w' + n, userId: u.id, name, gender: g, service, skills: SKILLS[service], exp: 2 + (n * 3) % 12,
        rate: 250 + (n * 37) % 300, city: CITIES[n % CITIES.length], available: n % 5 !== 0, verified: true,
        rating: 4 + ((n * 7) % 10) / 10, count: 5 + (n * 3) % 40,
        photo: `https://randomuser.me/api/portraits/${g === 'm' ? 'men' : 'women'}/${10 + n}.jpg`,
        reviews: [{ stars: 5, text: 'Very neat and on-time work.', by: 'Anand Sharma' }]
      });
    });
  });
  save();
}
if (fs.existsSync(DB)) db = JSON.parse(fs.readFileSync(DB)); else { fs.mkdirSync(path.dirname(DB), { recursive: true }); seed(); }

const safe = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const fail = (res, m, c = 400) => res.status(c).json({ error: m });
const auth = (...roles) => (req, res, next) => {
  const u = db.users.find(x => x.id === sessions[(req.headers.authorization || '').replace('Bearer ', '')]);
  if (!u) return fail(res, 'Please login first', 401);
  if (u.blocked) return fail(res, 'Account blocked by admin', 403);
  if (roles.length && !roles.includes(u.role)) return fail(res, 'Not allowed', 403);
  req.user = u; next();
};

// ---------- Auth ----------
app.post('/api/register', (req, res) => {
  const { name, email, password, role, gender, service, skills, exp, city, rate } = req.body;
  if (!name || !email || !password || password.length < 6) return fail(res, 'Name, email and password (min 6 chars) required');
  if (db.users.some(u => u.email === email.toLowerCase())) return fail(res, 'Email already registered');
  if (!['customer', 'worker'].includes(role)) return fail(res, 'Invalid role');
  const u = { id: uid(), name, email: email.toLowerCase(), pass: hash(password), role, blocked: false };
  db.users.push(u);
  if (role === 'worker') {
    const g = gender === 'f' ? 'f' : 'm';
    db.workers.push({ id: 'w' + uid(), userId: u.id, name, gender: g, service: service || 'Electrician',
      skills: (skills || '').split(',').map(s => s.trim()).filter(Boolean), exp: +exp || 0, rate: +rate || 300, city: city || 'Chidambaram',
      available: true, verified: false, rating: 0, count: 0, reviews: [],
      photo: `https://randomuser.me/api/portraits/${g === 'm' ? 'men' : 'women'}/${Math.floor(Math.random() * 60) + 60}.jpg` });
  }
  save(); res.json({ ok: true });
});
app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;
  const u = db.users.find(x => x.email === (email || '').toLowerCase() && x.pass === hash(password || ''));
  if (!u || (role && u.role !== role)) return fail(res, 'Invalid credentials for ' + (role || 'account'));
  if (u.blocked) return fail(res, 'Account blocked by admin', 403);
  const t = uid() + uid(); sessions[t] = u.id; res.json({ token: t, user: safe(u) });
});

// ---------- Public: services & workers (guest allowed) ----------
const visible = () => db.workers.filter(w => w.verified && !db.users.find(u => u.id === w.userId).blocked);
app.get('/api/services', (req, res) => res.json(SERVICES.map(([name, icon, desc]) => ({ name, icon, desc, count: visible().filter(w => w.service === name).length }))));
app.get('/api/workers', (req, res) => res.json(visible().filter(w => !req.query.service || w.service === req.query.service)));
app.get('/api/workers/:id', (req, res) => { const w = db.workers.find(x => x.id === req.params.id); w ? res.json(w) : fail(res, 'Worker not found', 404); });

// Voice/text -> service detection (speech-to-text happens in browser)
app.post('/api/voice-parse', (req, res) => {
  const t = (req.body.text || '').toLowerCase();
  let best = null, score = 0;
  SERVICES.forEach(s => { const sc = s[3].split(',').filter(k => t.includes(k.trim())).length; if (sc > score) { score = sc; best = s[0]; } });
  res.json({ service: best, workers: best ? visible().filter(w => w.service === best) : [] });
});

// ---------- Worker self ----------
app.get('/api/me/worker', auth('worker'), (req, res) => res.json(db.workers.find(w => w.userId === req.user.id)));
app.post('/api/me/worker/toggle', auth('worker'), (req, res) => { const w = db.workers.find(x => x.userId === req.user.id); w.available = !w.available; save(); res.json(w); });

// ---------- Job requests ----------
const decorate = r => { const w = db.workers.find(x => x.id === r.workerId), c = db.users.find(x => x.id === r.customerId); return { ...r, workerName: w.name, customerName: c.name }; };
app.post('/api/requests', auth('customer'), (req, res) => {
  const w = db.workers.find(x => x.id === req.body.workerId);
  if (!w || !req.body.description) return fail(res, 'Worker and job description required');
  const r = { id: 'r' + uid(), customerId: req.user.id, workerId: w.id, service: w.service, description: req.body.description,
    date: req.body.date || '', address: req.body.address || '', status: 'pending', amount: 0, rated: false, created: new Date().toISOString() };
  db.requests.push(r); save(); res.json(r);
});
app.get('/api/requests', auth(), (req, res) => {
  const me = db.workers.find(w => w.userId === req.user.id);
  const list = db.requests.filter(r => req.user.role === 'admin' || r.customerId === req.user.id || (me && r.workerId === me.id));
  res.json(list.reverse().map(decorate));
});
app.patch('/api/requests/:id', auth('worker', 'customer'), (req, res) => {
  const r = db.requests.find(x => x.id === req.params.id); if (!r) return fail(res, 'Not found', 404);
  const w = db.workers.find(x => x.id === r.workerId), a = req.body.action;
  const isW = req.user.role === 'worker' && w.userId === req.user.id, isC = req.user.role === 'customer' && r.customerId === req.user.id;
  if (!isW && !isC) return fail(res, 'Not your request', 403);
  const T = { accept: ['pending', 'accepted'], reject: ['pending', 'rejected'], start: ['accepted', 'in_progress'], complete: ['in_progress', 'completed'] };
  if (isW && T[a]) {
    if (r.status !== T[a][0]) return fail(res, 'Invalid step');
    r.status = T[a][1];
    if (a === 'complete') r.amount = Math.max(1, +req.body.hours || 2) * w.rate;
  } else if (isC && a === 'pay') {
    if (r.status !== 'completed') return fail(res, 'Job not completed yet');
    r.status = 'paid'; r.paidAt = new Date().toISOString(); // simulated payment
  } else if (isC && a === 'rate') {
    const s = +req.body.stars;
    if (r.status !== 'paid' || r.rated || s < 1 || s > 5) return fail(res, 'Cannot rate now');
    w.rating = (w.rating * w.count + s) / (w.count + 1); w.count++;
    w.reviews.unshift({ stars: s, text: req.body.text || '', by: req.user.name }); r.rated = true;
  } else return fail(res, 'Invalid action');
  save(); res.json(decorate(r));
});

// ---------- Chat ----------
function canChat(u, r) { const w = db.workers.find(x => x.id === r.workerId); return r && (r.customerId === u.id || w.userId === u.id || u.role === 'admin'); }
app.get('/api/messages/:rid', auth(), (req, res) => {
  const r = db.requests.find(x => x.id === req.params.rid); if (!canChat(req.user, r)) return fail(res, 'Not allowed', 403);
  res.json(db.messages.filter(m => m.rid === r.id));
});
app.post('/api/messages/:rid', auth(), (req, res) => {
  const r = db.requests.find(x => x.id === req.params.rid); if (!canChat(req.user, r) || !req.body.text) return fail(res, 'Not allowed', 403);
  db.messages.push({ rid: r.id, from: req.user.id, name: req.user.name, text: req.body.text, at: new Date().toISOString() }); save(); res.json({ ok: true });
});

// ---------- Complaints & Admin ----------
app.post('/api/complaints', auth('customer', 'worker'), (req, res) => {
  db.complaints.push({ id: 'c' + uid(), by: req.user.name, requestId: req.body.requestId, text: req.body.text, status: 'open' }); save(); res.json({ ok: true });
});
app.get('/api/admin/overview', auth('admin'), (req, res) => res.json({
  users: db.users.filter(u => u.role !== 'admin').map(u => ({ ...safe(u), blocked: u.blocked })),
  workers: db.workers, requests: db.requests.length, complaints: db.complaints
}));
app.patch('/api/admin/workers/:id', auth('admin'), (req, res) => { const w = db.workers.find(x => x.id === req.params.id); w.verified = !w.verified; save(); res.json(w); });
app.patch('/api/admin/users/:id', auth('admin'), (req, res) => { const u = db.users.find(x => x.id === req.params.id); u.blocked = !u.blocked; save(); res.json(safe(u)); });
app.patch('/api/admin/complaints/:id', auth('admin'), (req, res) => { const c = db.complaints.find(x => x.id === req.params.id); c.status = 'resolved'; save(); res.json(c); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`VoiceHire running at http://localhost:${PORT}`));
