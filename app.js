const state = {
  branches: ['All branches', 'Main Campus', 'Whitefield Campus', 'North Campus'],
  activeBranch: 'Main Campus',
  activeUserId: 'arjun',
  users: [
    { id: 'arjun', name: 'Arjun Kumar', initials: 'AK', role: 'Group Administrator', branches: 'All branches', status: 'Active' },
    { id: 'meera', name: 'Meera Patel', initials: 'MP', role: 'Transport Manager', branches: 'Main Campus', status: 'Active' },
    { id: 'priya', name: 'Priya Sharma', initials: 'PS', role: 'Grievance Officer', branches: 'Whitefield Campus', status: 'Active' },
    { id: 'dev', name: 'Dev Kumar', initials: 'DK', role: 'Task Manager', branches: 'All branches', status: 'Active' },
    { id: 'ravi', name: 'Ravi Kumar', initials: 'RK', role: 'Driver / Attendant', branches: 'Main Campus', status: 'Active' }
  ],
  buses: [
    { reg: 'KA 01 AB 4821', code: 'GV-01', model: 'Tata Starbus', capacity: 44, odometer: 48236, status: 'On route', driver: 'Ravi Kumar', parking: 'Inside campus', branch: 'Main Campus' },
    { reg: 'KA 01 CD 9610', code: 'GV-02', model: 'Eicher Skyline', capacity: 38, odometer: 35691, status: 'On route', driver: 'Suresh N.', parking: 'Outside campus', branch: 'Whitefield Campus' },
    { reg: 'KA 01 EF 3456', code: 'GV-03', model: 'Tata Starbus', capacity: 44, odometer: 52319, status: 'In service', driver: '—', parking: 'Inside campus', branch: 'Main Campus' },
    { reg: 'KA 01 GH 7129', code: 'GV-04', model: 'Ashok Leyland', capacity: 52, odometer: 71420, status: 'Available', driver: 'Meera P.', parking: 'Outside campus', branch: 'North Campus' },
    { reg: 'KA 01 JK 2890', code: 'GV-05', model: 'Eicher Skyline', capacity: 38, odometer: 28473, status: 'Available', driver: 'Arif Khan', parking: 'Inside campus', branch: 'Whitefield Campus' }
  ],
  logs: [
    { bus:'GV-01', route:'R-01 · Indiranagar', driver:'Ravi Kumar', opening:48236, closing:48310, km:74, branch:'Main Campus', parking:'Inside campus', tripOneLabel:'Out', tripOneTime:'06:25', tripTwoOut:'14:40', tripTwoIn:'16:05', arrival:'Out · 06:25', status:'Complete' },
    { bus:'GV-02', route:'R-04 · Whitefield', driver:'Suresh N.', opening:35691, closing:35756, km:65, branch:'Whitefield Campus', parking:'Outside campus', tripOneLabel:'In', tripOneTime:'08:09', tripTwoOut:'14:35', tripTwoIn:'16:12', arrival:'In · 08:09', status:'Complete' },
    { bus:'GV-03', route:'R-02 · Koramangala', driver:'', opening:'—', closing:'—', km:'—', branch:'Main Campus', parking:'Inside campus', tripOneLabel:'Out', tripOneTime:'—', tripTwoOut:'—', tripTwoIn:'—', arrival:'—', status:'Missing' }
  ],
  fuel: [
    { bus:'GV-01', branch:'Main Campus', quantity:32, rate:92.45, amount:2958.40, vendor:'Indian Oil · Indiranagar', efficiency:'4.8 km/L', status:'Good' },
    { bus:'GV-02', branch:'Whitefield Campus', quantity:28, rate:92.45, amount:2588.60, vendor:'Shell · Old Airport Rd', efficiency:'4.3 km/L', status:'Watch' },
    { bus:'GV-04', branch:'North Campus', quantity:36, rate:92.45, amount:3328.20, vendor:'Indian Oil · Indiranagar', efficiency:'4.9 km/L', status:'Good' }
  ]
};

const main = document.querySelector('#appMain');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');
let currentView = 'master-dashboard';
const activeUser = () => state.users.find(user => user.id === state.activeUserId);
const permissionMap = {
  'Group Administrator': ['*'],
  'Branch Administrator': ['master-dashboard', 'dashboard', 'fleet', 'daily-log', 'fuel', 'routes', 'team', 'students', 'tracking', 'maintenance', 'compliance', 'reports', 'alerts', 'grievances', 'tasks', 'access-control'],
  'Transport Manager': ['master-dashboard', 'dashboard', 'fleet', 'daily-log', 'fuel', 'routes', 'team', 'students', 'tracking', 'maintenance', 'compliance', 'reports', 'alerts'],
  'Grievance Officer': ['master-dashboard', 'grievances'],
  'Task Manager': ['master-dashboard', 'tasks'],
  'Driver / Attendant': ['master-dashboard', 'daily-log', 'tracking']
};
const canAccess = view => activeUser().status === 'Active' && (permissionMap[activeUser().role]?.includes('*') || permissionMap[activeUser().role]?.includes(view));
const availableBranches = () => activeUser().branches === 'All branches' ? state.branches : [activeUser().branches];
function openView(view) { if (!canAccess(view)) { notify(`${activeUser().role} does not have access to this app.`); return; } render(view); }

const badge = (text) => {
  const kind = /complete|active|available|good|valid|on route|present/i.test(text) ? 'good' : /missing|expired|critical|late|breakdown/i.test(text) ? 'danger' : /service|watch|due|pending|expiring/i.test(text) ? 'warning' : 'info';
  return `<span class="badge ${kind}">${text}</span>`;
};
const header = (title, subtitle, actions = '') => `<header class="page-head"><div><h1>${title}</h1><p>${subtitle} <span class="branch-context">• ${state.activeBranch}</span></p></div><div class="head-actions"><select class="branch-selector" id="branchSelector" aria-label="Active branch">${availableBranches().map(branch => `<option ${branch === state.activeBranch ? 'selected' : ''}>${branch}</option>`).join('')}</select><span class="date-chip">▣ &nbsp; Monday, 15 September 2026</span>${actions}<span class="role-chip">${activeUser().role}</span><span class="user-chip"><span class="tiny-avatar">${activeUser().initials}</span> ${activeUser().name.split(' ')[0]}</span></div></header>`;
const card = (content, classes = '') => `<section class="card ${classes}">${content}</section>`;
const noResults = (text) => `<tr><td colspan="8" style="text-align:center;padding:29px;color:#7c8997">${text}</td></tr>`;

function dashboard() {
  return `${header('Good morning, Arjun', 'Here’s how your transport network is moving today.', '<button class="button primary" data-action="open-log">＋ Add daily log</button>')}
  <div class="metrics">
    ${metric('Fleet status','18','16 active · 1 in service','▱','blue','89%')}
    ${metric('Today’s distance','1,246','km · 82% of plan','↝','green','82%', 'green')}
    ${metric('Fuel consumed','264 L','₹24,407 spent today','◒','orange','63%', 'orange')}
    ${metric('Trips completed','31 / 36','5 routes still running','✓','purple','86%')}
    ${metric('On-time arrival','94%','2 buses arrived late','◷','blue','94%')}
  </div>
  <div class="dashboard-grid">
    ${card(`<div class="section-head"><div><h2>Today’s route activity</h2><p>Live progress across the morning run</p></div><button class="text-button" data-goto="tracking">Open live map →</button></div><div class="table-wrap"><table><thead><tr><th>ROUTE</th><th>BUS</th><th>DRIVER</th><th>PROGRESS</th><th>STATUS</th></tr></thead><tbody><tr><td><span class="route-name"><span class="route-letter">R1</span><span><b class="strong">Indiranagar</b><br><small>24 stops</small></span></span></td><td>GV-01</td><td>Ravi Kumar</td><td><span class="badge good">Arrived</span></td><td>${badge('Complete')}</td></tr><tr><td><span class="route-name"><span class="route-letter">R4</span><span><b class="strong">Whitefield</b><br><small>19 stops</small></span></span></td><td>GV-02</td><td>Suresh N.</td><td><span class="badge warning">Near school</span></td><td>${badge('On route')}</td></tr><tr><td><span class="route-name"><span class="route-letter">R7</span><span><b class="strong">HSR Layout</b><br><small>21 stops</small></span></span></td><td>GV-07</td><td>Meera Patel</td><td><span class="badge danger">11 min late</span></td><td>${badge('Late')}</td></tr><tr><td><span class="route-name"><span class="route-letter">R2</span><span><b class="strong">Koramangala</b><br><small>17 stops</small></span></span></td><td>GV-08</td><td>Arif Khan</td><td><span class="badge good">Arrived</span></td><td>${badge('Complete')}</td></tr></tbody></table></div>`, 'section-card')}
    ${card(`<div class="section-head"><div><h2>Needs attention</h2><p>7 alerts need a decision</p></div><button class="text-button" data-goto="alerts">View all</button></div><div class="alert-item"><span class="alert-symbol danger">!</span><div><strong>Insurance expires in 4 days</strong><span>GV-12 · Action needed before 19 Sep</span></div><time>Urgent</time></div><div class="alert-item"><span class="alert-symbol warning">⚙</span><div><strong>Service due soon</strong><span>GV-03 · Brake service due in 240 km</span></div><time>Today</time></div><div class="alert-item"><span class="alert-symbol warning">◒</span><div><strong>Low fuel efficiency</strong><span>GV-02 · 4.3 km/L vs 4.8 average</span></div><time>Today</time></div><div class="alert-item"><span class="alert-symbol info">↝</span><div><strong>Route deviation detected</strong><span>GV-07 · HSR Layout, 0.6 km off route</span></div><time>8:21 AM</time></div>`, 'section-card')}
  </div>
  <div class="lower-grid">
    ${card(`<div class="section-head"><div><h2>Trip timing</h2><p>Expected vs. actual school arrival</p></div><button class="text-button" data-goto="routes">All routes →</button></div><div class="timeline"><div class="timeline-row"><strong>R-01</strong><div class="timeline-track"><i style="width:100%"></i></div><small>08:02 · on time</small></div><div class="timeline-row"><strong>R-04</strong><div class="timeline-track warning"><i style="width:89%"></i></div><small>ETA 08:14</small></div><div class="timeline-row"><strong>R-07</strong><div class="timeline-track danger"><i style="width:72%"></i></div><small>+11 min late</small></div><div class="timeline-row"><strong>R-02</strong><div class="timeline-track"><i style="width:100%"></i></div><small>07:56 · on time</small></div></div>`, 'section-card')}
    ${card(`<div class="section-head"><div><h2>Team attendance</h2><p>Morning duty roster</p></div><button class="text-button" data-goto="team">Manage team →</button></div><div class="attendee"><span class="avatar orange">RK</span><span><strong>Ravi Kumar</strong><small>Driver · GV-01</small></span>${badge('Present')}</div><div class="attendee"><span class="avatar purple">MP</span><span><strong>Meera Patel</strong><small>Driver · GV-07</small></span>${badge('Present')}</div><div class="attendee"><span class="avatar">SN</span><span><strong>Suresh Nair</strong><small>Driver · GV-02</small></span>${badge('Present')}</div><div class="attendee"><span class="avatar orange">PK</span><span><strong>Priya K.</strong><small>Attendant · GV-04</small></span>${badge('Present')}</div>`, 'section-card')}
  </div>`;
}
function metric(label, value, note, icon, color, width, extra='') { return `<section class="card metric"><div class="metric-label"><span>${label}</span><i class="metric-icon ${color}">${icon}</i></div><div class="metric-value">${value}</div><div class="metric-note ${extra}">${note}</div><div class="metric-bar ${extra}"><i style="width:${width}"></i></div></section>`; }

function fleet() { const rows = state.buses.map(b => `<tr class="click-row"><td><b class="strong">${b.reg}</b><br><small>${b.code}</small></td><td>${b.model}</td><td>${b.capacity} seats</td><td>${b.odometer.toLocaleString()} km</td><td>${b.driver}</td><td>${badge(b.status)}</td><td><button class="text-button" data-action="edit-bus" data-code="${b.code}">View</button></td></tr>`).join(''); return `${header('Fleet', 'Manage vehicle records, status, devices, and service history.', '<button class="button primary" data-action="add-bus">＋ Add bus</button>')}<div class="summary-strip"><div class="card"><small>Total buses</small><strong>18</strong><span>Across 12 routes</span></div><div class="card"><small>Active today</small><strong>16</strong><span style="color:#16803c">▲ 2 more than yesterday</span></div><div class="card"><small>In maintenance</small><strong>1</strong><span>GV-03 · Brake service</span></div><div class="card"><small>Documents due</small><strong>3</strong><span style="color:#bc6400">Require attention this week</span></div></div>${card(`<div class="toolbar"><input class="search" data-search="fleet-table" placeholder="Search registration, code, or driver" /><button class="filter-chip">Status: All ⌄</button><button class="filter-chip">Route: All ⌄</button><button class="button secondary" data-action="export-buses">⇩ Export</button></div><div class="table-wrap"><table id="fleet-table"><thead><tr><th>VEHICLE</th><th>MAKE / MODEL</th><th>CAPACITY</th><th>ODOMETER</th><th>ASSIGNED DRIVER</th><th>STATUS</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="pagination"><span>Showing ${state.buses.length} of 18 vehicles</span><div><button>‹</button><button>1</button><button>2</button><button>›</button></div></div>`)}`; }

function dailyLog() { const rows = state.logs.map(l => `<tr><td><b class="strong">${l.bus}</b></td><td>${l.route}</td><td>${l.driver || '—'}</td><td>${l.opening}</td><td>${l.closing}</td><td>${l.km}${l.km !== '—' ? ' km':''}</td><td>${l.arrival}</td><td>${badge(l.status)}</td></tr>`).join(''); return `${header('Daily bus log', 'Record daily kilometre, duty, timing, and crew details.') }<div class="form-page"><section class="card form-card"><h2>Create today’s log</h2><p>Distance and fuel indicators are calculated automatically.</p><form id="dailyLogForm"><div class="form-grid"><div class="field"><label>Bus *</label><select id="logBus">${state.buses.map(b=>`<option value="${b.code}" data-odo="${b.odometer}" data-driver="${b.driver}">${b.code} · ${b.reg}</option>`).join('')}</select></div><div class="field"><label>Route *</label><select id="logRoute"><option>R-01 · Indiranagar</option><option>R-02 · Koramangala</option><option>R-04 · Whitefield</option><option>R-07 · HSR Layout</option></select></div><div class="field"><label>Opening odometer *</label><input id="openingOdo" type="number" value="48236" min="0" /></div><div class="field"><label>Closing odometer *</label><input id="closingOdo" type="number" placeholder="e.g. 48310" min="0" /></div><div class="field"><label>Start time</label><input type="time" value="06:25" /></div><div class="field"><label>School arrival</label><input type="time" value="08:05" /></div><div class="field"><label>Route departure</label><input type="time" value="14:40" /></div><div class="field"><label>Final return</label><input type="time" value="16:05" /></div><div class="field"><label>Driver</label><select id="logDriver"><option>Ravi Kumar</option><option>Suresh Nair</option><option>Meera Patel</option><option>Arif Khan</option></select></div><div class="field"><label>Attendant</label><select><option>Priya K.</option><option>Anita S.</option><option>Rohan M.</option></select></div><div class="field full"><label>Remarks</label><textarea placeholder="Optional notes about delays, incidents, or vehicle condition"></textarea></div></div><div class="form-actions"><button type="reset" class="button secondary">Clear</button><button class="button primary">Save daily log</button></div></form></section><aside class="card calc-card"><h2>Trip calculation</h2><div class="calc-list"><div><span>Opening odometer</span><strong id="calcOpen">48,236 km</strong></div><div><span>Closing odometer</span><strong id="calcClose">—</strong></div><div><span>Total distance</span><strong id="calcKm">—</strong></div><div><span>Expected route distance</span><strong>72 km</strong></div></div><div class="hint"><b>Tip:</b> Add the closing odometer after the afternoon drop to close this log. Route distance alerts appear when the recorded distance varies by more than 10%.</div></aside></div>${card(`<div class="section-head"><div><h2>Today’s logs</h2><p>Monday, 15 September 2026</p></div><button class="button secondary" data-action="export-logs">⇩ Export logs</button></div><div class="table-wrap"><table><thead><tr><th>BUS</th><th>ROUTE</th><th>DRIVER</th><th>OPENING</th><th>CLOSING</th><th>DISTANCE</th><th>ARRIVAL</th><th>STATUS</th></tr></thead><tbody id="logTable">${rows}</tbody></table></div>`, 'section-card')}`; }

function fuel() { const rows = state.fuel.map(f => `<tr><td><b class="strong">${f.bus}</b></td><td>${f.vendor}</td><td>${f.quantity} L</td><td>₹${f.rate.toFixed(2)}</td><td><b>₹${f.amount.toLocaleString('en-IN', {minimumFractionDigits:2})}</b></td><td>${f.efficiency}</td><td>${badge(f.status)}</td></tr>`).join(''); return `${header('Fuel management', 'Track fuel fills, consumption, efficiency, and costs.', '<button class="button secondary" data-action="vendors">Manage vendors</button>')}<div class="form-page"><section class="card form-card"><h2>Record diesel fill</h2><p>Cost and efficiency are calculated as you enter data.</p><form id="fuelForm"><div class="form-grid"><div class="field"><label>Bus *</label><select id="fuelBus">${state.buses.map(b=>`<option>${b.code} · ${b.reg}</option>`).join('')}</select></div><div class="field"><label>Fuel station / vendor *</label><select><option>Indian Oil · Indiranagar</option><option>Shell · Old Airport Rd</option><option>BPCL · Domlur</option></select></div><div class="field"><label>Opening fuel (L)</label><input type="number" value="9" min="0" /></div><div class="field"><label>Diesel filled (L) *</label><input id="fuelQty" type="number" value="32" min="0" step=".1" /></div><div class="field"><label>Rate per litre (₹) *</label><input id="fuelRate" type="number" value="92.45" min="0" step=".01" /></div><div class="field"><label>Closing fuel (L)</label><input type="number" value="7" min="0" step=".1" /></div><div class="field"><label>Distance since last fill (km)</label><input id="fuelDistance" type="number" value="154" min="0" /></div><div class="field"><label>Invoice number</label><input placeholder="Optional" /></div></div><div class="form-actions"><button type="reset" class="button secondary">Clear</button><button class="button primary">Save fuel entry</button></div></form></section><aside class="card calc-card"><h2>Fuel calculation</h2><div class="calc-list"><div><span>Fuel amount</span><strong id="fuelAmount">₹2,958.40</strong></div><div><span>Fuel efficiency</span><strong id="fuelEfficiency">4.8 km/L</strong></div><div><span>Cost per km</span><strong id="fuelCostKm">₹19.21</strong></div><div><span>Fleet average</span><strong>4.8 km/L</strong></div></div><div class="hint"><b>Efficiency watch:</b> A bus is flagged when its km/L is 10% below the fleet average for two consecutive fills.</div></aside></div>${card(`<div class="section-head"><div><h2>Today’s fuel entries</h2><p>3 fills · 96 litres · ₹8,875.20</p></div><button class="button secondary" data-action="export-fuel">⇩ Export fuel report</button></div><div class="table-wrap"><table><thead><tr><th>BUS</th><th>VENDOR</th><th>QUANTITY</th><th>RATE</th><th>AMOUNT</th><th>EFFICIENCY</th><th>STATUS</th></tr></thead><tbody id="fuelTable">${rows}</tbody></table></div>`, 'section-card')}`; }

function routes() { return `${header('Route management', 'Manage stops, schedules, crew assignment, and route performance.', '<button class="button primary" data-action="add-route">＋ Create route</button>')}${card(`<div class="toolbar"><input class="search" data-search="routesTable" placeholder="Search routes or locations" /><button class="filter-chip">Status: All ⌄</button><button class="button secondary" data-action="export-routes">⇩ Export</button></div><div class="table-wrap"><table id="routesTable"><thead><tr><th>ROUTE</th><th>STOPS</th><th>DISTANCE</th><th>EXPECTED</th><th>ACTUAL</th><th>STUDENTS</th><th>CREW</th><th>STATUS</th></tr></thead><tbody><tr><td><span class="route-name"><span class="route-letter">R1</span><b class="strong">R-01 · Indiranagar</b></span></td><td>24 stops</td><td>36.8 km</td><td>06:30 – 08:05</td><td>08:02</td><td>41 / 44</td><td>Ravi · Priya</td><td>${badge('On time')}</td></tr><tr><td><span class="route-name"><span class="route-letter">R2</span><b class="strong">R-02 · Koramangala</b></span></td><td>17 stops</td><td>31.5 km</td><td>06:40 – 08:00</td><td>07:56</td><td>33 / 38</td><td>Arif · Anita</td><td>${badge('On time')}</td></tr><tr><td><span class="route-name"><span class="route-letter">R4</span><b class="strong">R-04 · Whitefield</b></span></td><td>19 stops</td><td>34.2 km</td><td>06:15 – 08:03</td><td>ETA 08:14</td><td>35 / 38</td><td>Suresh · Rohan</td><td>${badge('Running')}</td></tr><tr><td><span class="route-name"><span class="route-letter">R7</span><b class="strong">R-07 · HSR Layout</b></span></td><td>21 stops</td><td>38.4 km</td><td>06:22 – 08:10</td><td>08:21</td><td>42 / 44</td><td>Meera · Kavya</td><td>${badge('Late')}</td></tr><tr><td><span class="route-name"><span class="route-letter">R8</span><b class="strong">R-08 · Bellandur</b></span></td><td>16 stops</td><td>29.7 km</td><td>06:40 – 08:02</td><td>08:00</td><td>28 / 38</td><td>Vinay · Ritu</td><td>${badge('On time')}</td></tr></tbody></table></div>`, 'section-card')}${card(`<div class="section-head"><div><h2>Route R-01 · Indiranagar</h2><p>Stops and planned timing</p></div><button class="button secondary" data-action="edit-route">Edit route</button></div><div class="timeline"><div class="timeline-row"><strong>06:30</strong><div class="timeline-track"><i style="width:18%"></i></div><small>Domlur</small></div><div class="timeline-row"><strong>06:48</strong><div class="timeline-track"><i style="width:38%"></i></div><small>HAL 2nd Stage</small></div><div class="timeline-row"><strong>07:10</strong><div class="timeline-track"><i style="width:58%"></i></div><small>100 Ft Road</small></div><div class="timeline-row"><strong>07:38</strong><div class="timeline-track"><i style="width:78%"></i></div><small>Old Madras Road</small></div><div class="timeline-row"><strong>08:05</strong><div class="timeline-track"><i style="width:100%"></i></div><small>Green Valley School</small></div></div>`, 'section-card')}`; }

function team() { return `${header('Drivers & attendants', 'Employee profiles, licences, attendance, and duty assignment.', '<button class="button primary" data-action="add-team">＋ Add team member</button>')}<div class="summary-strip"><div class="card"><small>Drivers</small><strong>20</strong><span>19 present today</span></div><div class="card"><small>Attendants</small><strong>18</strong><span>18 present today</span></div><div class="card"><small>Licences due</small><strong>2</strong><span style="color:#bc6400">Within 30 days</span></div><div class="card"><small>Training due</small><strong>4</strong><span>Safety refresher</span></div></div>${card(`<div class="toolbar"><input class="search" data-search="teamTable" placeholder="Search name, role, or bus" /><button class="filter-chip">Role: All ⌄</button><button class="filter-chip">Status: All ⌄</button></div><div class="table-wrap"><table id="teamTable"><thead><tr><th>TEAM MEMBER</th><th>ROLE</th><th>PHONE</th><th>LICENCE / DOCUMENT</th><th>ASSIGNMENT</th><th>ATTENDANCE</th><th>STATUS</th></tr></thead><tbody><tr><td><span class="doc-status"><span class="avatar orange">RK</span><span><strong>Ravi Kumar</strong><small>EMP-021</small></span></td><td>Driver</td><td>+91 98452 10938</td><td>DL · expires 04 Jun 2028</td><td>GV-01 · R-01</td><td>08:12 AM</td><td>${badge('Present')}</td></tr><tr><td><span class="doc-status"><span class="avatar purple">MP</span><span><strong>Meera Patel</strong><small>EMP-034</small></span></td><td>Driver</td><td>+91 98450 83321</td><td>DL · expires 02 Oct 2026</td><td>GV-07 · R-07</td><td>08:10 AM</td><td>${badge('Present')}</td></tr><tr><td><span class="doc-status"><span class="avatar">SN</span><span><strong>Suresh Nair</strong><small>EMP-017</small></span></td><td>Driver</td><td>+91 99861 24317</td><td>DL · expires 16 Jan 2027</td><td>GV-02 · R-04</td><td>08:05 AM</td><td>${badge('Present')}</td></tr><tr><td><span class="doc-status"><span class="avatar orange">PK</span><span><strong>Priya K.</strong><small>EMP-051</small></span></td><td>Attendant</td><td>+91 98451 55389</td><td>ID · valid</td><td>GV-01 · R-01</td><td>08:00 AM</td><td>${badge('Present')}</td></tr><tr><td><span class="doc-status"><span class="avatar purple">AS</span><span><strong>Anita Sharma</strong><small>EMP-059</small></span></td><td>Attendant</td><td>+91 98803 77421</td><td>ID · valid</td><td>GV-02 · R-02</td><td>—</td><td>${badge('Leave')}</td></tr></tbody></table></div>`, 'section-card')}`; }

function students() { return `${header('Student transport', 'Transport allocation, route assignments, and boarding activity.', '<button class="button primary" data-action="add-student">＋ Add student</button>')}<div class="summary-strip"><div class="card"><small>Students assigned</small><strong>642</strong><span>Across 12 active routes</span></div><div class="card"><small>Boarded this morning</small><strong>601</strong><span style="color:#16803c">93.6% boarding rate</span></div><div class="card"><small>Absent / not boarded</small><strong>41</strong><span>Parent notices sent</span></div><div class="card"><small>Pending allocation</small><strong>8</strong><span>New admissions</span></div></div>${card(`<div class="toolbar"><input class="search" data-search="studentsTable" placeholder="Search student, parent, stop, or route" /><button class="filter-chip">Route: All ⌄</button><button class="filter-chip">Boarding: All ⌄</button><button class="button secondary" data-action="export-students">⇩ Export</button></div><div class="table-wrap"><table id="studentsTable"><thead><tr><th>STUDENT</th><th>CLASS</th><th>PARENT CONTACT</th><th>ROUTE / STOP</th><th>BUS</th><th>PICKUP</th><th>DROP</th></tr></thead><tbody><tr><td><b class="strong">Aarav Mehta</b><br><small>STU-1042</small></td><td>Grade 6B</td><td>Neha Mehta · +91 98450 31827</td><td>R-01 · HAL 2nd Stage</td><td>GV-01</td><td>${badge('Boarded 06:51')}</td><td><span style="color:#8793a0">Pending</span></td></tr><tr><td><b class="strong">Diya Rao</b><br><small>STU-1136</small></td><td>Grade 4A</td><td>Vivek Rao · +91 99860 11289</td><td>R-04 · AECS Layout</td><td>GV-02</td><td>${badge('Boarded 06:32')}</td><td><span style="color:#8793a0">Pending</span></td></tr><tr><td><b class="strong">Ishaan Shah</b><br><small>STU-0921</small></td><td>Grade 9C</td><td>Ria Shah · +91 98455 77120</td><td>R-07 · HSR Sector 2</td><td>GV-07</td><td>${badge('Boarded 06:41')}</td><td><span style="color:#8793a0">Pending</span></td></tr><tr><td><b class="strong">Mira Nair</b><br><small>STU-1198</small></td><td>Grade 3A</td><td>Anjana Nair · +91 99724 22210</td><td>R-02 · Sony World</td><td>GV-08</td><td>${badge('Absent')}</td><td><span style="color:#8793a0">—</span></td></tr></tbody></table></div>`, 'section-card')}`; }

function tracking() { return `${header('Live tracking', 'Real-time fleet location and route progress. Last update: just now.', '<button class="button secondary" data-action="refresh-map">↻ Refresh</button>')}<div class="map-layout"><section class="map"><div class="river"></div><div class="park"></div><span class="map-label" style="top:18%;left:14%">INDIRANAGAR</span><span class="map-label" style="top:69%;left:10%">KORAMANGALA</span><span class="map-label" style="top:20%;right:11%">WHITEFIELD</span><span class="map-label" style="bottom:11%;right:15%">HSR LAYOUT</span><div class="route-line"></div><div class="route-line amber"></div><div class="school-pin"><i>⌂</i> Green Valley School</div><div class="bus-pin" style="top:31%;left:28%"><i>▱</i> GV-01</div><div class="bus-pin late" style="top:24%;right:19%"><i>▱</i> GV-02</div><div class="bus-pin stop" style="bottom:23%;right:24%"><i>▱</i> GV-07</div><div class="bus-pin" style="bottom:28%;left:20%"><i>▱</i> GV-08</div></section><aside class="tracking-side">${card(`<div class="section-head"><div><h2>Active vehicles</h2><p>16 buses currently reporting</p></div></div><div class="live-row"><span class="bus-icon">▱</span><span><strong>GV-01</strong><small>R-01 · Indiranagar</small></span><span class="speed">32 km/h</span></div><div class="live-row"><span class="bus-icon">▱</span><span><strong>GV-02</strong><small>R-04 · Whitefield</small></span><span class="speed late">28 km/h</span></div><div class="live-row"><span class="bus-icon">▱</span><span><strong>GV-07</strong><small>R-07 · HSR Layout</small></span><span class="speed late">Stopped</span></div><div class="live-row"><span class="bus-icon">▱</span><span><strong>GV-08</strong><small>R-02 · Koramangala</small></span><span class="speed">0 km/h</span></div>`, 'vehicle-live')}${card(`<div class="journey-head"><h2>GV-02 journey</h2>${badge('On route')}</div><div class="journey-route"><strong>R-04 · Whitefield</strong><p>18 of 19 stops completed · 1.2 km to school</p></div><div class="stops"><div class="stop"><strong>ITPL Main Road</strong><small>07:17 · departed</small></div><div class="stop"><strong>AECS Layout</strong><small>07:28 · departed</small></div><div class="stop active"><strong>Green Valley School</strong><small>ETA 08:14 · 11 min late</small></div></div>`, 'journey') }</aside></div>`; }

function maintenance() { return `${header('Maintenance', 'Preventive schedules, repairs, breakdowns, and vehicle service costs.', '<button class="button primary" data-action="schedule-service">＋ Schedule service</button>')}<div class="maintenance-grid">${card(`<div class="section-head"><div><h2>Upcoming service</h2><p>Prioritised by due date and distance</p></div><button class="text-button" data-goto="alerts">View alerts</button></div><div class="due-list"><div class="due-item"><span class="due-date"><b>17</b>SEP</span><span><strong>GV-03 · Brake service</strong><small>Due in 240 km · 1,760 km since last service</small></span><button class="button secondary" data-action="schedule-service">Schedule</button></div><div class="due-item"><span class="due-date"><b>22</b>SEP</span><span><strong>GV-12 · Engine oil change</strong><small>Due in 7 days · 4,840 km since last change</small></span><button class="button secondary" data-action="schedule-service">Schedule</button></div><div class="due-item"><span class="due-date"><b>28</b>SEP</span><span><strong>GV-08 · Tyre rotation</strong><small>Due in 13 days · 9,200 km since rotation</small></span><button class="button secondary" data-action="schedule-service">Schedule</button></div><div class="due-item"><span class="due-date"><b>04</b>OCT</span><span><strong>GV-05 · Battery inspection</strong><small>Quarterly preventive check</small></span><button class="button secondary" data-action="schedule-service">Schedule</button></div></div>`, 'section-card')}${card(`<div class="section-head"><div><h2>Maintenance cost</h2><p>September 2026 · ₹86,450 total</p></div><button class="text-button" data-goto="reports">View report →</button></div><div class="chart-card" style="padding:0"><div class="line-chart"><div class="bar-group" data-label="W1"><i class="bar" style="height:43%"></i><i class="bar green" style="height:24%"></i></div><div class="bar-group" data-label="W2"><i class="bar" style="height:58%"></i><i class="bar green" style="height:32%"></i></div><div class="bar-group" data-label="W3"><i class="bar" style="height:36%"></i><i class="bar green" style="height:21%"></i></div><div class="bar-group" data-label="W4"><i class="bar" style="height:73%"></i><i class="bar green" style="height:38%"></i></div></div></div><div class="report-metrics"><div><span>Preventive</span><strong>₹52,300</strong></div><div><span>Repairs</span><strong>₹26,950</strong></div><div><span>Breakdowns</span><strong>₹7,200</strong></div></div>`, 'section-card')}</div>${card(`<div class="section-head"><div><h2>Service history</h2><p>Recent completed service and repairs</p></div><button class="button secondary">⇩ Export history</button></div><div class="table-wrap"><table><thead><tr><th>DATE</th><th>BUS</th><th>TYPE</th><th>WORK COMPLETED</th><th>VENDOR</th><th>COST</th><th>NEXT DUE</th></tr></thead><tbody><tr><td>12 Sep 2026</td><td><b class="strong">GV-10</b></td><td>Preventive</td><td>Engine oil, filter, general inspection</td><td>Metro Motors</td><td>₹8,450</td><td>17,000 km</td></tr><tr><td>09 Sep 2026</td><td><b class="strong">GV-06</b></td><td>Repair</td><td>Rear brake pad replacement</td><td>City Garage</td><td>₹4,600</td><td>Inspection at 5,000 km</td></tr><tr><td>04 Sep 2026</td><td><b class="strong">GV-15</b></td><td>Breakdown</td><td>Battery replacement</td><td>Battery World</td><td>₹7,200</td><td>04 Sep 2027</td></tr></tbody></table></div>`, 'section-card')}`; }

function compliance() { return `${header('Compliance', 'Vehicle and crew documents, equipment checks, and expiry notifications.', '<button class="button primary" data-action="add-document">＋ Add document</button>')}<div class="summary-strip"><div class="card"><small>Compliant vehicles</small><strong>15 / 18</strong><span style="color:#16803c">All mandatory documents valid</span></div><div class="card"><small>Expiring in 30 days</small><strong>4</strong><span style="color:#bc6400">Action required soon</span></div><div class="card"><small>Expired documents</small><strong>1</strong><span style="color:#c52b2b">GV-14 pollution certificate</span></div><div class="card"><small>Equipment checks</small><strong>92%</strong><span>First aid & extinguishers</span></div></div>${card(`<div class="toolbar"><input class="search" data-search="complianceTable" placeholder="Search bus, document, or employee" /><button class="filter-chip">Document: All ⌄</button><button class="filter-chip">Status: All ⌄</button></div><div class="table-wrap"><table id="complianceTable"><thead><tr><th>ASSET / PERSON</th><th>DOCUMENT</th><th>REFERENCE</th><th>ISSUED</th><th>EXPIRY</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody><tr><td><span class="doc-status"><span class="doc-icon">▱</span><span><strong>GV-12</strong><small>KA 01 LM 8842</small></span></td><td>Insurance</td><td>POL-IC-409912</td><td>20 Sep 2025</td><td>19 Sep 2026</td><td>${badge('Expires in 4 days')}</td><td><button class="text-button" data-action="renew-document">Renew</button></td></tr><tr><td><span class="doc-status"><span class="doc-icon">▱</span><span><strong>GV-05</strong><small>KA 01 JK 2890</small></span></td><td>Fitness certificate</td><td>FIT-110483</td><td>03 Oct 2025</td><td>02 Oct 2026</td><td>${badge('Expires in 17 days')}</td><td><button class="text-button" data-action="renew-document">Renew</button></td></tr><tr><td><span class="doc-status"><span class="doc-icon">▱</span><span><strong>GV-14</strong><small>KA 01 NP 4360</small></span></td><td>Pollution certificate</td><td>PUC-241908</td><td>13 Mar 2026</td><td>12 Sep 2026</td><td>${badge('Expired')}</td><td><button class="text-button" data-action="renew-document">Renew</button></td></tr><tr><td><span class="doc-status"><span class="avatar orange">MP</span><span><strong>Meera Patel</strong><small>EMP-034 · Driver</small></span></td><td>Driving licence</td><td>KA05 20200084734</td><td>03 Oct 2021</td><td>02 Oct 2026</td><td>${badge('Expires in 17 days')}</td><td><button class="text-button" data-action="renew-document">Renew</button></td></tr><tr><td><span class="doc-status"><span class="doc-icon">▱</span><span><strong>GV-01</strong><small>KA 01 AB 4821</small></span></td><td>Fire extinguisher inspection</td><td>EQ-1049</td><td>02 Sep 2026</td><td>01 Mar 2027</td><td>${badge('Valid')}</td><td><button class="text-button" data-action="view-document">View</button></td></tr></tbody></table></div>`, 'section-card')}`; }

function reports() { const bars = [48,61,53,72,65,84,74].map((n,i)=>`<div class="bar-group" data-label="${['Mar','Apr','May','Jun','Jul','Aug','Sep'][i]}"><i class="bar" style="height:${n}%"></i><i class="bar green" style="height:${Math.round(n*.53)}%"></i></div>`).join(''); return `${header('Reports & analytics', 'Operational performance and cost trends for better decisions.', '<button class="button secondary" data-action="export-report">⇩ Export report</button>')}<div class="summary-strip"><div class="card"><small>Distance this month</small><strong>21,842 km</strong><span style="color:#16803c">▲ 4.2% vs last month</span></div><div class="card"><small>Fleet fuel efficiency</small><strong>4.78 km/L</strong><span style="color:#16803c">▲ 0.12 km/L vs last month</span></div><div class="card"><small>Average cost per km</small><strong>₹20.41</strong><span style="color:#16803c">▼ ₹0.62 vs last month</span></div><div class="card"><small>Fleet uptime</small><strong>96.4%</strong><span>1.6 days downtime</span></div></div>${card(`<div class="chart-toolbar"><div><h2>Distance & fuel trend</h2><p style="margin:4px 0 0;color:#758194;font-size:11px">Monthly kilometres and litres consumed</p></div><div class="chart-legend"><span><i></i> Distance (×100 km)</span><span><i class="green"></i> Fuel (×100 L)</span></div></div><div class="line-chart">${bars}</div>`, 'chart-card') }<div class="dashboard-grid" style="margin-top:20px"><section class="card section-card"><div class="section-head"><div><h2>Route performance</h2><p>September 2026</p></div><button class="text-button" data-action="export-routes">Download data</button></div><div class="table-wrap"><table><thead><tr><th>ROUTE</th><th>DISTANCE</th><th>FUEL EFF.</th><th>COST / KM</th><th>ON-TIME</th></tr></thead><tbody><tr><td><b class="strong">R-01 · Indiranagar</b></td><td>2,816 km</td><td>4.92 km/L</td><td>₹19.76</td><td>98%</td></tr><tr><td><b class="strong">R-04 · Whitefield</b></td><td>2,612 km</td><td>4.51 km/L</td><td>₹21.23</td><td>89%</td></tr><tr><td><b class="strong">R-07 · HSR Layout</b></td><td>2,941 km</td><td>4.63 km/L</td><td>₹20.88</td><td>86%</td></tr><tr><td><b class="strong">R-02 · Koramangala</b></td><td>2,399 km</td><td>4.95 km/L</td><td>₹19.62</td><td>97%</td></tr></tbody></table></div></section>${card(`<div class="section-head"><div><h2>Management snapshot</h2><p>September 2026</p></div></div><div class="alert-item"><span class="alert-symbol info">↝</span><div><strong>18,072 student boardings</strong><span>Average 94.1% of assigned students</span></div></div><div class="alert-item"><span class="alert-symbol warning">⚙</span><div><strong>₹86,450 maintenance cost</strong><span>6 preventive services · 3 repairs</span></div></div><div class="alert-item"><span class="alert-symbol danger">◷</span><div><strong>4.6% trip delay rate</strong><span>Higher on Whitefield and HSR routes</span></div></div>`, 'section-card')}</div>`; }

function alerts() { return `${header('Alerts & notifications', 'Monitor exceptions and close out operational issues.', '<button class="button secondary" data-action="mark-read">✓ Mark all read</button>')}<div class="alerts-layout">${card(`<div class="section-head"><div><h2>Open alerts</h2><p>7 active alerts · sorted by urgency</p></div><button class="text-button" data-action="resolve-all">Resolve all low priority</button></div><div class="alert-feed" id="alertFeed"><div class="alert-item"><span class="alert-symbol danger">!</span><div><strong>Insurance expires in 4 days</strong><span>GV-12 insurance needs renewal before 19 September. The bus will be blocked from route assignment after its expiry.</span></div><time>Urgent</time><button class="button secondary" data-action="resolve-alert">Review</button></div><div class="alert-item"><span class="alert-symbol danger">⚑</span><div><strong>Pollution certificate expired</strong><span>GV-14 PUC expired on 12 September. Update the document before operating the bus.</span></div><time>3 days ago</time><button class="button secondary" data-action="resolve-alert">Review</button></div><div class="alert-item"><span class="alert-symbol warning">⚙</span><div><strong>Brake service due within 240 km</strong><span>GV-03 has reached 1,760 km since the last brake service.</span></div><time>Today</time><button class="button secondary" data-action="resolve-alert">Schedule</button></div><div class="alert-item"><span class="alert-symbol warning">◒</span><div><strong>Fuel efficiency below threshold</strong><span>GV-02 logged 4.3 km/L — 10% below fleet average for the second consecutive fill.</span></div><time>Today</time><button class="button secondary" data-action="resolve-alert">Review</button></div><div class="alert-item"><span class="alert-symbol warning">◷</span><div><strong>Route R-07 arrived 11 minutes late</strong><span>GV-07 reached school at 08:21. Traffic and a 0.6 km deviation were detected.</span></div><time>08:21 AM</time><button class="button secondary" data-action="resolve-alert">Investigate</button></div><div class="alert-item"><span class="alert-symbol info">⌖</span><div><strong>Route deviation detected</strong><span>GV-07 is 0.6 km from planned route near HSR Layout.</span></div><time>07:53 AM</time><button class="button secondary" data-action="resolve-alert">View map</button></div><div class="alert-item"><span class="alert-symbol info">▤</span><div><strong>Daily log missing</strong><span>GV-03 has no morning log. Assigned driver: not set.</span></div><time>07:35 AM</time><button class="button secondary" data-action="resolve-alert">Add log</button></div></div>`, 'section-card')}${card(`<div class="filter-card"><h2 style="font-size:16px;margin:0">Filter alerts</h2><div class="filter-group"><strong>Severity</strong><label class="filter-check"><input type="checkbox" checked /> Critical <span style="margin-left:auto;color:#8a96a4">2</span></label><label class="filter-check"><input type="checkbox" checked /> Warning <span style="margin-left:auto;color:#8a96a4">3</span></label><label class="filter-check"><input type="checkbox" checked /> Information <span style="margin-left:auto;color:#8a96a4">2</span></label></div><div class="filter-group"><strong>Category</strong><label class="filter-check"><input type="checkbox" checked /> Compliance</label><label class="filter-check"><input type="checkbox" checked /> Vehicle maintenance</label><label class="filter-check"><input type="checkbox" checked /> Fleet operations</label><label class="filter-check"><input type="checkbox" checked /> Fuel efficiency</label></div><div class="hint"><b>Notification rule:</b> Critical issues are sent immediately to the transport manager. Warnings are included in the morning and end-of-day summaries.</div></div>`, 'card alert-filter')}</div>`; }

const views = {'master-dashboard': masterDashboard, dashboard, fleet, 'daily-log':dailyLog, fuel, routes, team, students, tracking, maintenance, compliance, reports, alerts, grievances, tasks, 'access-control': accessControl};
function render(view = currentView) { currentView = view; main.innerHTML = views[view](); document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); main.focus({preventScroll:true}); bindView(); }

function bindView() {
  const branchSelector = document.querySelector('#branchSelector');
  if (branchSelector) branchSelector.addEventListener('change', event => {
    state.activeBranch = event.target.value;
    notify(`${state.activeBranch} selected.`);
    render(currentView);
  });
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => openView(b.dataset.goto)));
  document.querySelectorAll('[data-search]').forEach(input => input.addEventListener('input', () => filterTable(input.dataset.search, input.value)));
  const logForm = document.querySelector('#dailyLogForm'); if (logForm) { bindLogCalc(); logForm.addEventListener('submit', saveLog); document.querySelector('#logBus').addEventListener('change', syncLogBus); }
  const fuelForm = document.querySelector('#fuelForm'); if (fuelForm) { bindFuelCalc(); fuelForm.addEventListener('submit', saveFuel); }
}
function filterTable(id, query) { document.querySelectorAll(`#${id} tbody tr`).forEach(row => row.hidden = !row.textContent.toLowerCase().includes(query.toLowerCase())); }
function syncLogBus(e) { const option = e.target.selectedOptions[0]; document.querySelector('#openingOdo').value = option.dataset.odo; document.querySelector('#logDriver').value = option.dataset.driver || 'Ravi Kumar'; updateLogCalc(); }
function bindLogCalc() { ['#openingOdo','#closingOdo'].forEach(s=>document.querySelector(s).addEventListener('input',updateLogCalc)); updateLogCalc(); }
function updateLogCalc() { const o=Number(document.querySelector('#openingOdo').value)||0,c=Number(document.querySelector('#closingOdo').value)||0; document.querySelector('#calcOpen').textContent=o?`${o.toLocaleString()} km`:'—'; document.querySelector('#calcClose').textContent=c?`${c.toLocaleString()} km`:'—'; document.querySelector('#calcKm').textContent=c>=o&&c?`${(c-o).toLocaleString()} km`:'—'; }
function bindFuelCalc() { ['#fuelQty','#fuelRate','#fuelDistance'].forEach(s=>document.querySelector(s).addEventListener('input',updateFuelCalc)); updateFuelCalc(); }
function updateFuelCalc() { const q=Number(document.querySelector('#fuelQty').value)||0,r=Number(document.querySelector('#fuelRate').value)||0,d=Number(document.querySelector('#fuelDistance').value)||0; const amount=q*r, efficiency=q?d/q:0,cost=d?amount/d:0; document.querySelector('#fuelAmount').textContent=`₹${amount.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;document.querySelector('#fuelEfficiency').textContent=efficiency?`${efficiency.toFixed(1)} km/L`:'—';document.querySelector('#fuelCostKm').textContent=cost?`₹${cost.toFixed(2)}`:'—'; }
function saveLog(e) { e.preventDefault(); const opening=Number(document.querySelector('#openingOdo').value),closing=Number(document.querySelector('#closingOdo').value); if(!closing||closing<opening){notify('Add a valid closing odometer reading.');return;} const bus=document.querySelector('#logBus').value, route=document.querySelector('#logRoute').value,driver=document.querySelector('#logDriver').value; state.logs.unshift({bus,route,driver,opening,closing,km:closing-opening,arrival:'08:05',status:'Complete'}); state.buses.find(b=>b.code===bus).odometer=closing; notify(`Daily log for ${bus} saved.`); render('daily-log'); }
function saveFuel(e) {e.preventDefault(); const bus=document.querySelector('#fuelBus').value.slice(0,5),quantity=Number(document.querySelector('#fuelQty').value),rate=Number(document.querySelector('#fuelRate').value),distance=Number(document.querySelector('#fuelDistance').value); if(!quantity||!rate){notify('Enter diesel quantity and rate.');return;} state.fuel.unshift({bus,quantity,rate,amount:quantity*rate,vendor:'Indian Oil · Indiranagar',efficiency:`${(distance/quantity).toFixed(1)} km/L`,status:distance/quantity<4.4?'Watch':'Good'});notify(`Fuel entry for ${bus} saved.`);render('fuel');}

function openModal(kind) { const content = kind==='add-bus' ? `<div class="modal-head"><div><h2>Add a bus</h2><p>Create a new fleet record. Documents and device details can be added after saving.</p></div><button class="close-modal" data-close>×</button></div><form id="busForm"><div class="form-grid"><div class="field"><label>Registration number *</label><input id="newReg" placeholder="KA 01 AB 1234" required /></div><div class="field"><label>Bus code *</label><input id="newCode" placeholder="GV-19" required /></div><div class="field"><label>Make / model *</label><input id="newModel" placeholder="e.g. Tata Starbus" required /></div><div class="field"><label>Seating capacity *</label><input id="newCapacity" type="number" placeholder="44" required /></div><div class="field"><label>Current odometer</label><input id="newOdometer" type="number" placeholder="0" /></div><div class="field"><label>Fuel tank capacity</label><input type="number" placeholder="e.g. 120 L" /></div><div class="field full"><label>Assigned driver</label><select id="newDriver"><option>Unassigned</option><option>Ravi Kumar</option><option>Suresh Nair</option><option>Meera Patel</option><option>Arif Khan</option></select></div></div><div class="form-actions"><button type="button" class="button secondary" data-close>Cancel</button><button class="button primary">Save bus</button></div></form>` : `<div class="modal-head"><div><h2>${kind}</h2><p>This action is ready to be connected to your school’s workflow.</p></div><button class="close-modal" data-close>×</button></div><div class="hint">In this prototype, records are demonstrated with realistic sample data. The next build step would connect this screen to your data source and permissions.</div><div class="form-actions"><button class="button primary" data-close>Done</button></div>`; modal.innerHTML=`<div class="modal-content">${content}</div>`;modal.showModal(); const form=document.querySelector('#busForm'); if(form)form.addEventListener('submit',saveBus); modal.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>modal.close())); }
function saveBus(e){e.preventDefault();const reg=document.querySelector('#newReg').value.trim(),code=document.querySelector('#newCode').value.trim().toUpperCase(),model=document.querySelector('#newModel').value.trim(),capacity=Number(document.querySelector('#newCapacity').value),odometer=Number(document.querySelector('#newOdometer').value)||0,driver=document.querySelector('#newDriver').value;state.buses.unshift({reg,code,model,capacity,odometer,status:'Available',driver:driver==='Unassigned'?'—':driver});modal.close();notify(`${code} added to fleet.`);render('fleet');}
function downloadCSV(name, columns, rows) { const csv=[columns, ...rows].map(row=>row.map(x=>`"${String(x).replaceAll('"','""')}"`).join(',')).join('\n'); const anchor=document.createElement('a');anchor.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));anchor.download=name;anchor.click();URL.revokeObjectURL(anchor.href);notify(`${name} downloaded.`);}

document.querySelector('#mainNav').addEventListener('click',e=>{const btn=e.target.closest('[data-view]');if(btn)openView(btn.dataset.view);});
document.querySelector('#settingsButton').addEventListener('click',()=>openModal('Settings'));
main.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(action==='add-bus')return openModal('add-bus');if(action==='open-log'||action==='resolve-alert'&&button.textContent.includes('Add log'))return render('daily-log');if(action==='schedule-service')return openModal('Schedule service');if(action==='add-document'||action==='renew-document')return openModal('Document renewal');if(action==='add-route')return openModal('Create route');if(action==='add-team')return openModal('Add team member');if(action==='add-student')return openModal('Add student');if(action==='vendors')return openModal('Fuel vendors');if(action==='edit-bus'||action==='view-document'||action==='edit-route')return openModal('Record details');if(action==='refresh-map'){notify('Vehicle positions updated just now.');return;}if(action==='mark-read'){notify('All alerts marked as read.');return;}if(action==='resolve-all'){document.querySelectorAll('#alertFeed .alert-item').forEach((row,i)=>{if(i>3)row.remove();});notify('Low priority alerts resolved.');return;}if(action==='resolve-alert'){button.textContent='Resolved';button.disabled=true;button.classList.add('secondary');notify('Alert updated.');return;}const maps={"export-buses":['fleet.csv',['Registration','Code','Model','Capacity','Odometer','Status'],state.buses.map(b=>[b.reg,b.code,b.model,b.capacity,b.odometer,b.status])],"export-logs":['daily-logs.csv',['Bus','Route','Driver','Opening','Closing','Distance','Status'],state.logs.map(l=>[l.bus,l.route,l.driver,l.opening,l.closing,l.km,l.status])],"export-fuel":['fuel-report.csv',['Bus','Vendor','Litres','Rate','Amount','Efficiency'],state.fuel.map(f=>[f.bus,f.vendor,f.quantity,f.rate,f.amount,f.efficiency])],"export-routes":['route-performance.csv',['Route','Distance','On-time'],[['R-01 Indiranagar','2,816 km','98%'],['R-04 Whitefield','2,612 km','89%'],['R-07 HSR Layout','2,941 km','86%']]],"export-students":['student-transport.csv',['Student','Class','Route'],[['Aarav Mehta','Grade 6B','R-01'],['Diya Rao','Grade 4A','R-04'],['Ishaan Shah','Grade 9C','R-07']]],"export-report":['management-report-september.csv',['Metric','Value'],[['Distance this month','21,842 km'],['Fleet fuel efficiency','4.78 km/L'],['Average cost per km','₹20.41'],['Fleet uptime','96.4%']]]};if(maps[action])downloadCSV(...maps[action]);});
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2400)}
render();

function masterDashboard() {
  return `${header('Campus operations', 'One place to run every school service across your branches.')}
    <section class="card master-hero"><span class="eyebrow" style="color:#8dd7f1">CAMPUS MASTER APP</span><h2>Everything moving together.</h2><p>Choose an operational app below. Each one shares your branch context, teams, and service data.</p></section>
    <div class="hint" style="margin-top:14px"><b>Demo build:</b> this GitHub version uses sample data and browser-only access previews. Do not enter real student, parent, employee, or financial data until a secure backend and authentication are connected.</div>
    <div class="app-grid">
      <section class="card app-module" data-goto="dashboard" tabindex="0"><span class="module-icon transport">▱</span><h2>Transport manager</h2><p>Fleet, routes, student runs, fuel, maintenance, live tracking, and compliance.</p><footer><span>16 buses active</span><span>Open app →</span></footer></section>
      <section class="card app-module" data-goto="grievances" tabindex="0"><span class="module-icon grievance">◉</span><h2>Parent grievances</h2><p>Receive, assign, track, and close parent concerns with a clear service trail.</p><footer><span>6 open cases</span><span>Open app →</span></footer></section>
      <section class="card app-module" data-goto="tasks" tabindex="0"><span class="module-icon tasks">✓</span><h2>Employee tasks</h2><p>Assign work, track ownership and due dates, and follow up on blocked tasks.</p><footer><span>14 open tasks</span><span>Open app →</span></footer></section>
      <section class="card app-module" data-goto="access-control" tabindex="0"><span class="module-icon tasks">♙</span><h2>Access & roles</h2><p>Give every employee the right role, branch scope, and set of approved apps.</p><footer><span>5 employee accounts</span><span>Manage access →</span></footer></section>
    </div>
    <div class="dashboard-grid" style="margin-top:20px">
      ${card(`<div class="section-head"><div><h2>Across your apps</h2><p>Today’s operational snapshot</p></div></div><div class="alert-item"><span class="alert-symbol warning">◉</span><div><strong>2 parent grievances need a response today</strong><span>One transport concern and one fee-query escalation.</span></div><time>Today</time></div><div class="alert-item"><span class="alert-symbol info">✓</span><div><strong>5 employee tasks are due by end of day</strong><span>Facilities, transport, and admin teams have assigned owners.</span></div><time>Today</time></div><div class="alert-item"><span class="alert-symbol danger">!</span><div><strong>1 compliance item needs urgent action</strong><span>GV-12 insurance is due to expire in four days.</span></div><time>Urgent</time></div>`, 'section-card')}
      ${card(`<div class="section-head"><div><h2>Branch pulse</h2><p>Current context: ${state.activeBranch}</p></div><button class="text-button" data-goto="reports">View analytics →</button></div><div class="timeline"><div class="timeline-row"><strong>Main</strong><div class="timeline-track"><i style="width:92%"></i></div><small>91% on-time</small></div><div class="timeline-row"><strong>Whitefield</strong><div class="timeline-track warning"><i style="width:83%"></i></div><small>3 open cases</small></div><div class="timeline-row"><strong>North</strong><div class="timeline-track"><i style="width:88%"></i></div><small>92% task close</small></div></div>`, 'section-card')}
    </div>`;
}

function grievances() {
  return `${header('Parent grievances', 'Receive, assign, and resolve concerns with a complete communication trail.', '<button class="button primary" data-action="add-grievance">＋ New grievance</button>')}
    <div class="summary-strip"><div class="card"><small>Open grievances</small><strong>6</strong><span>2 need response today</span></div><div class="card"><small>Resolved this month</small><strong>31</strong><span style="color:#16803c">89% within service target</span></div><div class="card"><small>Average resolution</small><strong>18 hrs</strong><span style="color:#16803c">▼ 4 hrs vs last month</span></div><div class="card"><small>Escalated</small><strong>2</strong><span style="color:#bc6400">Management attention needed</span></div></div>
    ${card(`<div class="toolbar"><input class="search" data-search="grievanceTable" placeholder="Search parent, student, issue, or ticket" /><button class="filter-chip">Status: Open ⌄</button><button class="filter-chip">Category: All ⌄</button><button class="button secondary" data-action="export-grievances">⇩ Export</button></div><div class="table-wrap"><table id="grievanceTable"><thead><tr><th>TICKET</th><th>PARENT / STUDENT</th><th>CATEGORY</th><th>SUBJECT</th><th>ASSIGNED TO</th><th>AGE</th><th>STATUS</th><th></th></tr></thead><tbody><tr><td><b class="strong">GRV-2048</b><br><small>High priority</small></td><td>Neha Mehta<br><small>Aarav · Grade 6B</small></td><td>Transport</td><td>Late morning pickup at HAL 2nd Stage</td><td>Arjun Kumar</td><td>4 hrs</td><td>${badge('In progress')}</td><td><button class="text-button" data-action="resolve-grievance">Resolve</button></td></tr><tr><td><b class="strong">GRV-2047</b><br><small>Normal</small></td><td>Vivek Rao<br><small>Diya · Grade 4A</small></td><td>Communication</td><td>Need update on route change notification</td><td>Priya S.</td><td>7 hrs</td><td>${badge('Open')}</td><td><button class="text-button" data-action="resolve-grievance">Resolve</button></td></tr><tr><td><b class="strong">GRV-2045</b><br><small>High priority</small></td><td>Ria Shah<br><small>Ishaan · Grade 9C</small></td><td>Transport</td><td>Safety concern near HSR pickup stop</td><td>Meera Patel</td><td>1 day</td><td>${badge('Escalated')}</td><td><button class="text-button" data-action="resolve-grievance">Review</button></td></tr><tr><td><b class="strong">GRV-2041</b><br><small>Normal</small></td><td>Anjana Nair<br><small>Mira · Grade 3A</small></td><td>Fees</td><td>Transport fee receipt request</td><td>Finance desk</td><td>2 days</td><td>${badge('Open')}</td><td><button class="text-button" data-action="resolve-grievance">Resolve</button></td></tr></tbody></table></div>`, 'section-card')}
    ${card(`<div class="section-head"><div><h2>Service workflow</h2><p>Every concern follows one clear path</p></div></div><div class="timeline"><div class="timeline-row"><strong>1</strong><div class="timeline-track"><i style="width:100%"></i></div><small>Received & acknowledged</small></div><div class="timeline-row"><strong>2</strong><div class="timeline-track"><i style="width:100%"></i></div><small>Assigned to owner</small></div><div class="timeline-row"><strong>3</strong><div class="timeline-track"><i style="width:100%"></i></div><small>Parent updated & resolved</small></div></div>`, 'section-card')}`;
}

function tasks() {
  return `${header('Employee tasks', 'Plan work across teams, keep ownership clear, and follow up before deadlines.', '<button class="button primary" data-action="add-task">＋ Create task</button>')}
    <div class="summary-strip"><div class="card"><small>Open tasks</small><strong>14</strong><span>Across 6 teams</span></div><div class="card"><small>Due today</small><strong>5</strong><span style="color:#bc6400">Needs check-in</span></div><div class="card"><small>Blocked tasks</small><strong>2</strong><span style="color:#c52b2b">Awaiting approval</span></div><div class="card"><small>Completed this week</small><strong>28</strong><span style="color:#16803c">▲ 17% vs last week</span></div></div>
    ${card(`<div class="section-head"><div><h2>Team workboard</h2><p>Current branch: ${state.activeBranch}</p></div><button class="button secondary" data-action="export-tasks">⇩ Export tasks</button></div><div class="kanban"><section class="kanban-column"><div class="kanban-head"><span>TO DO</span><span>5</span></div><article class="task-card"><h3>Confirm Diwali transport schedule</h3><p>Transport · Owner: Arjun Kumar · Due today</p><footer>${badge('High')}<button data-action="advance-task">Start →</button></footer></article><article class="task-card"><h3>Call parents with missing documents</h3><p>Admissions · Owner: Nisha R. · Due 16 Sep</p><footer>${badge('Normal')}<button data-action="advance-task">Start →</button></footer></article><article class="task-card"><h3>Upload September staff roster</h3><p>HR · Owner: Dev K. · Due 17 Sep</p><footer>${badge('Normal')}<button data-action="advance-task">Start →</button></footer></article></section><section class="kanban-column"><div class="kanban-head"><span>IN PROGRESS</span><span>7</span></div><article class="task-card"><h3>Resolve R-07 route safety concern</h3><p>Transport · Owner: Meera P. · Due today</p><footer>${badge('High')}<button data-action="advance-task">Complete →</button></footer></article><article class="task-card"><h3>Update parent app pickup instructions</h3><p>Communications · Owner: Priya S. · Due 16 Sep</p><footer>${badge('Normal')}<button data-action="advance-task">Complete →</button></footer></article><article class="task-card"><h3>Review housekeeping vendor invoices</h3><p>Facilities · Owner: Sandeep M. · Due 18 Sep</p><footer>${badge('Normal')}<button data-action="advance-task">Complete →</button></footer></article></section><section class="kanban-column"><div class="kanban-head"><span>BLOCKED / REVIEW</span><span>2</span></div><article class="task-card"><h3>Approve new bus GPS device quote</h3><p>Finance · Awaiting principal approval</p><footer>${badge('Pending')}<button data-action="advance-task">Review →</button></footer></article><article class="task-card"><h3>Close GRV-2045 after route inspection</h3><p>Transport · Awaiting site report</p><footer>${badge('Pending')}<button data-action="advance-task">Review →</button></footer></article></section></div>`, 'section-card')}`;
}

main.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'add-grievance') return openModal('New parent grievance');
  if (action === 'add-task') return openModal('Create employee task');
  if (action === 'resolve-grievance') {
    const row = button.closest('tr');
    if (row) row.remove();
    notify('Grievance updated and moved to the resolved queue.');
  }
  if (action === 'advance-task') {
    button.textContent = 'Updated ✓';
    button.disabled = true;
    notify('Task progress updated.');
  }
  if (action === 'export-grievances') downloadCSV('parent-grievances.csv', ['Ticket', 'Parent', 'Category', 'Status'], [['GRV-2048', 'Neha Mehta', 'Transport', 'In progress'], ['GRV-2047', 'Vivek Rao', 'Communication', 'Open'], ['GRV-2045', 'Ria Shah', 'Transport', 'Escalated']]);
  if (action === 'export-tasks') downloadCSV('employee-tasks.csv', ['Task', 'Team', 'Owner', 'Status'], [['Confirm Diwali transport schedule', 'Transport', 'Arjun Kumar', 'To do'], ['Resolve R-07 route safety concern', 'Transport', 'Meera P.', 'In progress'], ['Approve new bus GPS device quote', 'Finance', 'Principal', 'Blocked']]);
});

// Daily log rules for a two-run school service: two arrivals to school and two departures home.
// The first morning timestamp follows the parking rule requested by the transport office.
function dailyLog() {
  const rows = state.logs.filter(l => state.activeBranch === 'All branches' || l.branch === state.activeBranch).map(l => {
    const firstLabel = l.morningOneLabel || l.tripOneLabel || (l.parking === 'Outside campus' ? 'In' : 'Out');
    const firstTime = l.morningOneTime || l.tripOneTime || '—';
    const schoolTwo = l.morningTwoIn || '08:50';
    const homeOneOut = l.homeOneOut || l.tripTwoOut || '—';
    const homeOneIn = l.homeOneIn || '15:35';
    const homeTwoOut = l.homeTwoOut || '15:55';
    const homeTwoIn = l.homeTwoIn || l.tripTwoIn || '—';
    return `<tr><td><b class="strong">${l.bus}</b></td><td>${l.route}</td><td>${l.parking || 'Inside campus'}</td><td>${l.opening}</td><td>${l.closing}</td><td>${l.km}${l.km !== '—' ? ' km' : ''}</td><td><b>${firstLabel}</b> · ${firstTime}</td><td>In · ${schoolTwo}</td><td>Out ${homeOneOut} → In ${homeOneIn}</td><td>Out ${homeTwoOut} → In ${homeTwoIn}</td><td>${badge(l.status)}</td></tr>`;
  }).join('');
  return `${header('Daily bus log', 'Track two school runs and two home runs for every bus.')}
    <div class="form-page">
      <section class="card form-card">
        <h2>Create today’s log</h2>
        <p>Morning has two runs bringing students to school. Afternoon has two runs taking them home.</p>
        <form id="dailyLogForm">
          <div class="form-grid">
            <div class="field"><label>Bus *</label><select id="logBus">${state.buses.filter(b => state.activeBranch === 'All branches' || b.branch === state.activeBranch).map(b => `<option value="${b.code}" data-odo="${b.odometer}" data-driver="${b.driver}">${b.code} · ${b.reg}</option>`).join('')}</select></div>
            <div class="field"><label>Route *</label><select id="logRoute"><option>R-01 · Indiranagar</option><option>R-02 · Koramangala</option><option>R-04 · Whitefield</option><option>R-07 · HSR Layout</option></select></div>
            <div class="field"><label>Bus parking location *</label><select id="parkingLocation"><option>Inside campus</option><option>Outside campus</option></select></div>
            <div class="field"><label>Opening odometer *</label><input id="openingOdo" type="number" value="48236" min="0" /></div>
            <div class="field"><label>Closing odometer *</label><input id="closingOdo" type="number" placeholder="After the final home run" min="0" /></div>
            <div class="field full"><label style="color:#1877d3">Morning — students to school</label></div>
            <div class="field"><label id="firstRunLabel">Out time · School run 1 *</label><input id="morningOneTime" type="time" value="06:25" required /></div>
            <div class="field"><label>In time · School run 2 *</label><input id="morningTwoIn" type="time" value="08:50" required /></div>
            <div class="field full"><label style="color:#1877d3">Afternoon — students home</label></div>
            <div class="field"><label>Out time · Home run 1 *</label><input id="homeOneOut" type="time" value="14:40" required /></div>
            <div class="field"><label>In time · Home run 1 *</label><input id="homeOneIn" type="time" value="15:35" required /></div>
            <div class="field"><label>Out time · Home run 2 *</label><input id="homeTwoOut" type="time" value="15:55" required /></div>
            <div class="field"><label>In time · Home run 2 *</label><input id="homeTwoIn" type="time" value="16:40" required /></div>
            <div class="field"><label>Driver</label><select id="logDriver"><option>Ravi Kumar</option><option>Suresh Nair</option><option>Meera Patel</option><option>Arif Khan</option></select></div>
            <div class="field"><label>Attendant</label><select><option>Priya K.</option><option>Anita S.</option><option>Rohan M.</option></select></div>
            <div class="field full"><label>Remarks</label><textarea placeholder="Optional notes about delays, incidents, or vehicle condition"></textarea></div>
          </div>
          <div class="form-actions"><button type="reset" class="button secondary">Clear</button><button class="button primary">Save daily log</button></div>
        </form>
      </section>
      <aside class="card calc-card"><h2>Day calculation</h2><div class="calc-list"><div><span>Opening odometer</span><strong id="calcOpen">48,236 km</strong></div><div><span>Closing odometer</span><strong id="calcClose">—</strong></div><div><span>Total daily distance</span><strong id="calcKm">—</strong></div><div><span>Scheduled student runs</span><strong>4 runs</strong></div></div><div class="hint" id="parkingHint"><b>Inside campus:</b> record the first school run’s out time, when the bus leaves campus for student pickup.</div></aside>
    </div>
    ${card(`<div class="section-head"><div><h2>Today’s logs</h2><p>Monday, 15 September 2026</p></div><button class="button secondary" data-action="export-logs">⇩ Export logs</button></div><div class="table-wrap"><table><thead><tr><th>BUS</th><th>ROUTE</th><th>PARKING</th><th>OPENING</th><th>CLOSING</th><th>DISTANCE</th><th>SCHOOL RUN 1</th><th>SCHOOL RUN 2</th><th>HOME RUN 1</th><th>HOME RUN 2</th><th>STATUS</th></tr></thead><tbody id="logTable">${rows}</tbody></table></div>`, 'section-card')}`;
}

function configureDailyTrips() {
  const parking = document.querySelector('#parkingLocation');
  if (!parking) return;
  const inside = parking.value === 'Inside campus';
  document.querySelector('#firstRunLabel').textContent = inside ? 'Out time · School run 1 *' : 'In time · School run 1 *';
  document.querySelector('#morningOneTime').value = inside ? '06:25' : '08:05';
  document.querySelector('#parkingHint').innerHTML = inside
    ? '<b>Inside campus:</b> record the first school run’s out time, when the bus leaves campus for student pickup.'
    : '<b>Outside campus:</b> record the first school run’s in time, when the bus arrives at school with students.';
}

function bindLogCalc() {
  ['#openingOdo', '#closingOdo'].forEach(selector => document.querySelector(selector).addEventListener('input', updateLogCalc));
  const parking = document.querySelector('#parkingLocation');
  parking.addEventListener('change', configureDailyTrips);
  configureDailyTrips();
  updateLogCalc();
}

function syncLogBus(e) {
  const selectedBus = state.buses.find(bus => bus.code === e.target.value);
  const option = e.target.selectedOptions[0];
  document.querySelector('#openingOdo').value = option.dataset.odo;
  document.querySelector('#logDriver').value = option.dataset.driver || 'Ravi Kumar';
  document.querySelector('#parkingLocation').value = selectedBus?.parking || 'Inside campus';
  configureDailyTrips();
  updateLogCalc();
}

function saveLog(e) {
  e.preventDefault();
  const opening = Number(document.querySelector('#openingOdo').value);
  const closing = Number(document.querySelector('#closingOdo').value);
  if (!closing || closing < opening) { notify('Add a valid closing odometer reading after the final home run.'); return; }
  const bus = document.querySelector('#logBus').value;
  const parking = document.querySelector('#parkingLocation').value;
  const morningOneLabel = parking === 'Inside campus' ? 'Out' : 'In';
  const morningOneTime = document.querySelector('#morningOneTime').value;
  state.logs.unshift({
    bus,
    branch: state.activeBranch === 'All branches' ? 'Main Campus' : state.activeBranch,
    route: document.querySelector('#logRoute').value,
    driver: document.querySelector('#logDriver').value,
    parking,
    opening,
    closing,
    km: closing - opening,
    morningOneLabel,
    morningOneTime,
    morningTwoIn: document.querySelector('#morningTwoIn').value,
    homeOneOut: document.querySelector('#homeOneOut').value,
    homeOneIn: document.querySelector('#homeOneIn').value,
    homeTwoOut: document.querySelector('#homeTwoOut').value,
    homeTwoIn: document.querySelector('#homeTwoIn').value,
    arrival: `${morningOneLabel} · ${morningOneTime}`,
    status: 'Complete'
  });
  const vehicle = state.buses.find(item => item.code === bus);
  if (vehicle) { vehicle.odometer = closing; vehicle.parking = parking; }
  notify(`Four-run daily log for ${bus} saved.`);
  render('daily-log');
}

// Fleet is scoped to the selected branch; choosing “All branches” gives the central transport team a full view.
function fleet() {
  const scopedBuses = state.buses.filter(bus => state.activeBranch === 'All branches' || bus.branch === state.activeBranch);
  const active = scopedBuses.filter(bus => /on route|available/i.test(bus.status)).length;
  const rows = scopedBuses.map(bus => `<tr class="click-row"><td><b class="strong">${bus.reg}</b><br><small>${bus.code}</small></td><td>${bus.branch}</td><td>${bus.model}</td><td>${bus.capacity} seats</td><td>${bus.odometer.toLocaleString()} km</td><td>${bus.parking}</td><td>${bus.driver}</td><td>${badge(bus.status)}</td><td><button class="text-button" data-action="edit-bus">View</button></td></tr>`).join('') || noResults('No buses are assigned to this branch yet.');
  return `${header('Fleet', 'Manage vehicle records, parking location, documents, and service history.', '<button class="button primary" data-action="add-bus">＋ Add bus</button>')}
    <div class="summary-strip"><div class="card"><small>Buses in scope</small><strong>${scopedBuses.length}</strong><span>${state.activeBranch}</span></div><div class="card"><small>Active today</small><strong>${active}</strong><span style="color:#16803c">Ready for route assignment</span></div><div class="card"><small>Inside campus</small><strong>${scopedBuses.filter(bus => bus.parking === 'Inside campus').length}</strong><span>First run records out time</span></div><div class="card"><small>Outside campus</small><strong>${scopedBuses.filter(bus => bus.parking === 'Outside campus').length}</strong><span>First run records in time</span></div></div>
    ${card(`<div class="toolbar"><input class="search" data-search="fleet-table" placeholder="Search registration, code, driver, or branch" /><button class="filter-chip">${state.activeBranch} ⌄</button><button class="button secondary" data-action="export-buses">⇩ Export</button></div><div class="table-wrap"><table id="fleet-table"><thead><tr><th>VEHICLE</th><th>BRANCH</th><th>MAKE / MODEL</th><th>CAPACITY</th><th>ODOMETER</th><th>PARKING</th><th>DRIVER</th><th>STATUS</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="pagination"><span>Showing ${scopedBuses.length} vehicle${scopedBuses.length === 1 ? '' : 's'} in this view</span><div><button>‹</button><button>1</button><button>›</button></div></div>`)}`;
}

function saveBus(e) {
  e.preventDefault();
  const reg = cleanText(document.querySelector('#newReg').value);
  const code = cleanText(document.querySelector('#newCode').value).toUpperCase();
  const model = cleanText(document.querySelector('#newModel').value);
  const capacity = Number(document.querySelector('#newCapacity').value);
  const odometer = Number(document.querySelector('#newOdometer').value) || 0;
  const driver = document.querySelector('#newDriver').value;
  state.buses.unshift({ reg, code, model, capacity, odometer, status: 'Available', driver: driver === 'Unassigned' ? '—' : driver, parking: 'Inside campus', branch: state.activeBranch === 'All branches' ? 'Main Campus' : state.activeBranch });
  modal.close();
  notify(`${code} added to ${state.activeBranch === 'All branches' ? 'Main Campus' : state.activeBranch}.`);
  render('fleet');
}

function accessControl() {
  const roleRows = [
    ['Group Administrator', 'All branches', 'Every app and setting', 'Full control'],
    ['Branch Administrator', 'Assigned branch', 'Every operational app', 'Manage branch data'],
    ['Transport Manager', 'Assigned branch', 'Transport manager', 'Manage fleet and daily operations'],
    ['Grievance Officer', 'Assigned branch', 'Parent grievances', 'Receive, assign, and resolve cases'],
    ['Task Manager', 'Assigned branch', 'Employee tasks', 'Create, assign, and close tasks'],
    ['Driver / Attendant', 'Assigned route', 'Daily log, live tracking', 'Update own route activity']
  ].map(role => `<tr><td><b class="strong">${role[0]}</b></td><td>${role[1]}</td><td>${role[2]}</td><td>${role[3]}</td><td><button class="text-button" data-action="edit-role">Edit permissions</button></td></tr>`).join('');
  const users = state.users.map(user => `<tr ${user.id === state.activeUserId ? 'style="background:#f3f8fd"' : ''}><td><span class="doc-status"><span class="avatar ${user.id === 'meera' ? 'purple' : user.id === 'ravi' ? 'orange' : ''}">${user.initials}</span><span><strong>${user.name}</strong><small>${user.id === state.activeUserId ? 'Current session' : 'Employee account'}</small></span></span></td><td>${user.role}</td><td>${user.branches}</td><td>${badge(user.status)}</td><td><button class="text-button" data-action="activate-user" data-user="${user.id}">${user.id === state.activeUserId ? 'Active now' : 'Preview access'}</button></td></tr>`).join('');
  return `${header('Access & roles', 'Give employees only the apps, branch data, and actions they need.', '<button class="button primary" data-action="add-employee-access">＋ Add employee access</button>')}
    <div class="summary-strip"><div class="card"><small>Employee accounts</small><strong>${state.users.length}</strong><span>All active</span></div><div class="card"><small>Configured roles</small><strong>6</strong><span>Least-privilege access</span></div><div class="card"><small>Branch scopes</small><strong>3</strong><span>Main, Whitefield, North</span></div><div class="card"><small>Protected apps</small><strong>3</strong><span>Transport, grievances, tasks</span></div></div>
    ${card(`<div class="section-head"><div><h2>Employee access</h2><p>Select “Preview access” to verify what a role can see in the master app.</p></div><span class="role-chip">Signed in: ${activeUser().role}</span></div><div class="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>ROLE</th><th>BRANCH SCOPE</th><th>ACCOUNT STATUS</th><th></th></tr></thead><tbody>${users}</tbody></table></div>`, 'section-card')}
    ${card(`<div class="section-head"><div><h2>Role permission matrix</h2><p>Permissions are applied across every branch and app.</p></div><button class="button secondary" data-action="edit-role">Manage roles</button></div><div class="table-wrap"><table><thead><tr><th>ROLE</th><th>DATA SCOPE</th><th>APP ACCESS</th><th>PERMISSION LEVEL</th><th></th></tr></thead><tbody>${roleRows}</tbody></table></div>`, 'section-card')}
    ${card(`<div class="hint"><b>How access works:</b> each employee receives a role and a branch scope. The role decides which apps and actions are available; the branch scope limits which school data they can see and update.</div>`, 'section-card')}`;
}

main.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'add-employee-access') return openModal('Add employee access');
  if (button.dataset.action === 'edit-role') return openModal('Role permissions');
  if (button.dataset.action === 'activate-user') {
    const user = state.users.find(item => item.id === button.dataset.user);
    if (!user) return;
    state.activeUserId = user.id;
    state.activeBranch = user.branches;
    notify(`Access preview: ${user.name} · ${user.role}.`);
    render('master-dashboard');
  }
});

function cleanText(value) {
  return String(value ?? '').replace(/[<>]/g, '').trim();
}

function safeCsvCell(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
}

function downloadCSV(name, columns, rows) {
  const csv = [columns, ...rows]
    .map(row => row.map(value => `"${safeCsvCell(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const anchor = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
  notify(`${name} downloaded.`);
}

function recordIsInCurrentBranch(record) {
  return state.activeBranch === 'All branches' || record.branch === state.activeBranch;
}

function exportBranchScopedData(action) {
  if (action === 'export-buses') {
    const rows = state.buses.filter(recordIsInCurrentBranch).map(bus => [bus.reg, bus.code, bus.branch, bus.model, bus.capacity, bus.odometer, bus.status]);
    downloadCSV('fleet.csv', ['Registration', 'Code', 'Branch', 'Model', 'Capacity', 'Odometer', 'Status'], rows);
  }
  if (action === 'export-logs') {
    const rows = state.logs.filter(recordIsInCurrentBranch).map(log => [log.bus, log.branch, log.route, log.driver, log.opening, log.closing, log.km, log.status]);
    downloadCSV('daily-logs.csv', ['Bus', 'Branch', 'Route', 'Driver', 'Opening', 'Closing', 'Distance', 'Status'], rows);
  }
  if (action === 'export-fuel') {
    const rows = state.fuel.filter(recordIsInCurrentBranch).map(fuel => [fuel.bus, fuel.branch, fuel.vendor, fuel.quantity, fuel.rate, fuel.amount, fuel.efficiency]);
    downloadCSV('fuel-report.csv', ['Bus', 'Branch', 'Vendor', 'Litres', 'Rate', 'Amount', 'Efficiency'], rows);
  }
}

// Capture export clicks before the generic handler so branch-scoped data is never mixed in these reports.
main.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || !['export-buses', 'export-logs', 'export-fuel'].includes(button.dataset.action)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  exportBranchScopedData(button.dataset.action);
}, true);

function applyRenderedBranchScope() {
  const fuelRows = document.querySelectorAll('#fuelTable tr');
  fuelRows.forEach((row, index) => { row.hidden = !recordIsInCurrentBranch(state.fuel[index]); });

  const fuelBus = document.querySelector('#fuelBus');
  if (!fuelBus) return;
  [...fuelBus.options].forEach(option => {
    const bus = state.buses.find(item => item.code === option.value.slice(0, 5));
    const permitted = bus && recordIsInCurrentBranch(bus);
    option.hidden = !permitted;
    option.disabled = !permitted;
  });
  if (fuelBus.selectedOptions[0]?.disabled) {
    const firstPermitted = [...fuelBus.options].find(option => !option.disabled);
    if (firstPermitted) fuelBus.value = firstPermitted.value;
  }
}

function bindView() {
  const branchSelector = document.querySelector('#branchSelector');
  if (branchSelector) branchSelector.addEventListener('change', event => {
    state.activeBranch = event.target.value;
    notify(`${state.activeBranch} selected.`);
    render(currentView);
  });
  document.querySelectorAll('[data-goto]').forEach(button => button.addEventListener('click', () => openView(button.dataset.goto)));
  document.querySelectorAll('[data-search]').forEach(input => input.addEventListener('input', () => filterTable(input.dataset.search, input.value)));
  applyRenderedBranchScope();
  const logForm = document.querySelector('#dailyLogForm');
  if (logForm) {
    bindLogCalc();
    logForm.addEventListener('submit', saveLog);
    document.querySelector('#logBus').addEventListener('change', syncLogBus);
  }
  const fuelForm = document.querySelector('#fuelForm');
  if (fuelForm) {
    bindFuelCalc();
    fuelForm.addEventListener('submit', saveFuel);
  }
}

function saveFuel(event) {
  event.preventDefault();
  const bus = document.querySelector('#fuelBus').value.slice(0, 5);
  const quantity = Number(document.querySelector('#fuelQty').value);
  const rate = Number(document.querySelector('#fuelRate').value);
  const distance = Number(document.querySelector('#fuelDistance').value);
  if (!quantity || !rate) { notify('Enter diesel quantity and rate.'); return; }
  state.fuel.unshift({
    bus,
    branch: state.activeBranch === 'All branches' ? 'Main Campus' : state.activeBranch,
    quantity,
    rate,
    amount: quantity * rate,
    vendor: 'Indian Oil · Indiranagar',
    efficiency: `${(distance / quantity).toFixed(1)} km/L`,
    status: distance / quantity < 4.4 ? 'Watch' : 'Good'
  });
  notify(`Fuel entry for ${bus} saved.`);
  render('fuel');
}
