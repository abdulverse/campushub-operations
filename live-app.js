/* CampusHub live foundation: authenticated, branch-scoped Fleet and Daily Log. */
(() => {
  'use strict';

  const root = document.querySelector('#campusHubRoot');
  const modal = document.querySelector('#modal');
  const toast = document.querySelector('#toast');
  const config = window.CAMPUSHUB_SUPABASE || {};
  const state = {
    client: null, session: null, profile: null, membership: null, organization: null,
    scopes: [], branches: [], activeBranchId: '', buses: [], routes: [], employees: [],
    logs: [], accessDirectory: [], serviceDate: today(), view: 'dashboard', revision: 0,
    driver: { busId: '', sessionStartedAt: null, openingOdometer: null, currentTripIndex: 0, tripTimes: {}, position: null, watchId: null, error: '', dutyPurpose: 'student_transport' },
  };
  const roleCapabilities = {
    group_admin: ['*'],
    branch_admin: ['fleet.read', 'fleet.write', 'route.read', 'route.write', 'daily_log.read', 'daily_log.write', 'employee.read'],
    transport_manager: ['fleet.read', 'fleet.write', 'route.read', 'route.write', 'daily_log.read', 'daily_log.write', 'employee.read'],
    driver_attendant: ['fleet.read', 'daily_log.read'],
  };
  const dutyPurposeLabels = {
    student_transport: 'Student transport · regular trips',
    teacher_pickup: 'Teacher pickup',
    holiday_job: 'Holiday job',
    student_tour: 'Students tour',
    outing: 'Outing',
    fuel_filling: 'Fuel filling',
    repair_service: 'Repair / service',
    other_designated_job: 'Other designated job',
  };
  function dutyPurposeLabel(value) { return dutyPurposeLabels[value] || dutyPurposeLabels.other_designated_job; }
  function dutyPurposeOptions(selected) { return Object.entries(dutyPurposeLabels).map(([value, label]) => '<option value="' + e(value) + '"' + (value === selected ? ' selected' : '') + '>' + e(label) + '</option>').join(''); }

  function today() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function e(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }
  function text(value) { return String(value == null ? '' : value).trim() || null; }
  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function fmtKm(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' km' : '—';
  }
  function titleRole(role) {
    return String(role || '').split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  }
  function initials(value) {
    return String(value || 'CH').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  }
  function notify(message, kind) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show ' + (kind || '');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => { toast.className = 'toast'; }, 4200);
  }
  function configured() {
    return Boolean(
      root && window.supabase && typeof window.supabase.createClient === 'function' &&
      /^https:\/\/.+\.supabase\.co\/?$/.test(config.url || '') && String(config.anonKey || '').trim()
    );
  }
  function roles() { return [...new Set(state.scopes.filter(scope => scope.active).map(scope => scope.role))]; }
  function can(capability) {
    return roles().some(role => {
      const list = roleCapabilities[role] || [];
      return list.includes('*') || list.includes(capability);
    });
  }
  function branch() { return state.branches.find(item => item.id === state.activeBranchId) || null; }
  function branchName(id) { return state.branches.find(item => item.id === id)?.name || 'Selected branch'; }
  function bus(id) { return state.buses.find(item => item.id === id) || null; }
  function employeeName(id) { return state.employees.find(item => item.id === id)?.full_name || '—'; }
  function errorText(error, fallback) {
    return error && error.message ? fallback + ' ' + error.message : fallback;
  }
  function stale(revision) { return revision !== state.revision; }

  function statePage(title, body, icon) {
    root.innerHTML = '<main class="live-state"><div class="live-state-card"><span class="live-state-icon">' +
      e(icon || '⌁') + '</span><h1>' + e(title) + '</h1><p>' + e(body) + '</p></div></main>';
  }
  function loginPage() {
    root.innerHTML = '<main class="auth-page"><section class="auth-card">' +
      '<div class="auth-brand"><span class="brand-mark">✦</span><strong>campushub</strong></div>' +
      '<p class="eyebrow">SECURE OPERATIONS</p><h1>Sign in to your school workspace</h1>' +
      '<p>Use the email address invited by your CampusHub administrator. New accounts are not created from this screen.</p>' +
      '<form id="signInForm" class="auth-form"><label>Email<input name="email" type="email" autocomplete="email" required></label>' +
      '<label>Password<input name="password" type="password" autocomplete="current-password" required></label>' +
      '<button class="button primary" type="submit">Sign in securely</button></form>' +
      '<p class="auth-help">Need access? Please contact your CampusHub administrator.</p></section></main>';
  }
  function blockedPage(message) {
    root.innerHTML = '<main class="live-state"><div class="live-state-card"><span class="live-state-icon">⌾</span>' +
      '<h1>Account not enabled</h1><p>' + e(message) + '</p>' +
      '<button class="button secondary" data-live-action="sign-out">Sign out</button></div></main>';
  }
  function loadingPage(message) {
    root.innerHTML = '<main class="live-state"><div class="live-state-card"><span class="live-spinner"></span><h1>' +
      e(message) + '</h1><p>Please wait a moment.</p></div></main>';
  }

  function header(title, subtitle, actions) {
    const options = state.branches.map(item =>
      '<option value="' + e(item.id) + '"' + (item.id === state.activeBranchId ? ' selected' : '') + '>' + e(item.name) + '</option>'
    ).join('');
    return '<header class="page-head"><div><h1>' + e(title) + '</h1><p>' + e(subtitle) + '</p></div>' +
      '<div class="head-actions"><label class="live-branch-control">Branch<select id="branchSelector" aria-label="Active branch">' +
      options + '</select></label>' + (actions || '') + '</div></header>';
  }

  function shell() {
    const person = state.profile?.full_name || state.session?.user?.email || 'Account';
    const org = state.organization?.name || 'CampusHub';
    const roleText = roles().map(titleRole).join(' · ') || 'Member';
    root.innerHTML = '<div class="app live-app"><aside class="sidebar" aria-label="CampusHub navigation">' +
      '<div class="brand"><span class="brand-mark">✦</span><span>campushub</span></div>' +
      '<div class="school-switch"><span class="school-initial">' + e(org.slice(0, 2).toUpperCase()) + '</span>' +
      '<span><strong>' + e(org) + '</strong><small>Protected live workspace</small></span></div>' +
      '<nav class="nav"><p class="nav-label">MASTER APP</p>' +
      '<button class="nav-item ' + (state.view === 'dashboard' ? 'active' : '') + '" data-live-view="dashboard"><span>▦</span><b>Campus overview</b></button>' +
      '<p class="nav-label">TRANSPORT</p>' +
      '<button class="nav-item ' + (state.view === 'fleet' ? 'active' : '') + '" data-live-view="fleet"><span>▱</span><b>Fleet</b></button>' +
      '<button class="nav-item ' + (state.view === 'driver-app' ? 'active' : '') + '" data-live-view="driver-app"><span>◉</span><b>Driver app</b></button>' +
      '<button class="nav-item ' + (state.view === 'daily-log' ? 'active' : '') + '" data-live-view="daily-log"><span>▤</span><b>Daily log</b></button>' +
      '<button class="nav-item ' + (state.view === 'fuel' ? 'active' : '') + '" data-live-view="fuel"><span>◒</span><b>Fuel</b></button>' +
      '<button class="nav-item ' + (state.view === 'routes' ? 'active' : '') + '" data-live-view="routes"><span>⌁</span><b>Routes</b></button>' +
      (can('*') ? '<button class="nav-item ' + (state.view === 'branches' ? 'active' : '') + '" data-live-view="branches"><span>⌘</span><b>Branches</b></button>' : '') +
      '<p class="nav-label">PEOPLE & SAFETY</p>' +
      '<button class="nav-item ' + (state.view === 'team' ? 'active' : '') + '" data-live-view="team"><span>♙</span><b>Drivers & attendants</b></button>' +
      '<button class="nav-item ' + (state.view === 'students' ? 'active' : '') + '" data-live-view="students"><span>♧</span><b>Students</b></button>' +
      '<button class="nav-item ' + (state.view === 'tracking' ? 'active' : '') + '" data-live-view="tracking"><span>⌖</span><b>Live tracking</b></button>' +
      '<button class="nav-item ' + (state.view === 'maintenance' ? 'active' : '') + '" data-live-view="maintenance"><span>⚙</span><b>Maintenance</b></button>' +
      '<button class="nav-item ' + (state.view === 'compliance' ? 'active' : '') + '" data-live-view="compliance"><span>✓</span><b>Compliance</b></button>' +
      '<p class="nav-label">INSIGHTS</p>' +
      '<button class="nav-item ' + (state.view === 'reports' ? 'active' : '') + '" data-live-view="reports"><span>◫</span><b>Reports</b></button>' +
      '<button class="nav-item ' + (state.view === 'alerts' ? 'active' : '') + '" data-live-view="alerts"><span>◉</span><b>Alerts</b></button>' +
      '<p class="nav-label">MASTER SERVICES</p>' +
      '<button class="nav-item ' + (state.view === 'grievances' ? 'active' : '') + '" data-live-view="grievances"><span>◉</span><b>Parent grievances</b></button>' +
      '<button class="nav-item ' + (state.view === 'tasks' ? 'active' : '') + '" data-live-view="tasks"><span>✓</span><b>Employee tasks</b></button>' +
      '<button class="nav-item ' + (state.view === 'access' ? 'active' : '') + '" data-live-view="access"><span>♙</span><b>Access & roles</b></button></nav>' +
      '<div class="sidebar-footer"><div class="profile"><span class="profile-avatar">' + e(initials(person)) + '</span>' +
      '<span><strong>' + e(person) + '</strong><small>' + e(roleText) + '</small></span>' +
      '<button class="text-button" data-live-action="sign-out">Sign out</button></div></div></aside>' +
      '<main id="liveMain" tabindex="-1"></main></div>';
    renderView();
  }

  function renderView() {
    const main = document.querySelector('#liveMain');
    if (!main) return;
    if (!branch()) {
      main.innerHTML = '<section class="card live-empty"><h2>Select a branch</h2><p>This account has no active branch in its live access scope.</p></section>';
      return;
    }
    main.innerHTML = state.view === 'dashboard' ? dashboardMarkup() : state.view === 'daily-log' ? dailyMarkup() : state.view === 'branches' ? branchesMarkup() : state.view === 'fleet' ? fleetMarkup() : state.view === 'driver-app' ? driverAppMarkup() : state.view === 'access' ? accessMarkup() : moduleMarkup(state.view);
    if (state.view === 'daily-log') setDailyDefaults();
  }

  function dashboardMarkup() {
    const total = state.buses.length;
    const active = state.buses.filter(item => item.status !== 'inactive').length;
    return header('Campus overview', 'One secure workspace for every branch and school operation.') +
      '<div class="summary-strip"><div class="card"><small>Live buses</small><strong>' + total + '</strong><span>' + e(branchName(state.activeBranchId)) + '</span></div>' +
      '<div class="card"><small>Active today</small><strong>' + active + '</strong><span>Protected fleet records</span></div>' +
      '<div class="card"><small>Daily logs</small><strong>' + state.logs.length + '</strong><span>Selected service date</span></div>' +
      '<div class="card"><small>Branches</small><strong>' + state.branches.length + '</strong><span>Active workspace branches</span></div></div>' +
      '<section class="card section-card"><div class="section-head"><div><h2>CampusHub modules</h2><p>Every demo option is preserved in the live workspace. Secure data workflows are being enabled module by module.</p></div></div>' +
      '<div class="summary-strip"><div class="card"><small>Live now</small><strong>3</strong><span>Branches, fleet, daily log</span></div><div class="card"><small>Next rollout</small><strong>4</strong><span>Fuel, routes, team, access</span></div><div class="card"><small>Planned</small><strong>9</strong><span>Students, GPS, safety, reports</span></div><div class="card"><small>Security</small><strong>RLS</strong><span>Branch-scoped database rules</span></div></div></section>' +
      '<section class="card section-card"><div class="section-head"><div><h2>What happens next</h2><p>Choose any module from the left. Live modules read and write Supabase records; planned modules show their data scope and rollout status.</p></div></div><div class="hint"><b>No sample data is being mixed into your live workspace.</b> This keeps original student, parent, employee, location, and finance data protected while each module is connected.</div></section>';
  }

  const moduleDetails = {
    fuel: ['Fuel management', 'Diesel fills, vendors, efficiency, and cost per kilometre.', 'Fuel entries will calculate litres, amount, km/L, and cost/km from protected bus records.'],
    routes: ['Route management', 'Stops, distance, expected timings, assignments, and deviation.', 'Routes will be branch-scoped and shared with daily logs and future GPS tracking.'],
    team: ['Drivers & attendants', 'Employee profiles, licences, attendance, duty roster, and training.', 'Employee records will use role-based access and document-expiry alerts.'],
    students: ['Student transport', 'Students, parents, routes, stops, allocations, and boarding records.', 'Student and parent data will be added only after its privacy and import workflow is enabled.'],
    tracking: ['GPS & live tracking', 'Bus location, speed, stoppage, geofencing, and route deviation.', 'GPS devices and location retention rules must be configured before this screen becomes live.'],
    maintenance: ['Maintenance', 'Preventive service, repairs, breakdowns, costs, and next-service alerts.', 'Maintenance history will link to buses and generate KM-based reminders.'],
    compliance: ['Compliance', 'Fitness, insurance, permit, pollution, RC, licences, and expiry alerts.', 'Documents will be stored with expiry dates and restricted employee access.'],
    reports: ['Reports & analytics', 'Daily/monthly kilometres, fuel, expenses, downtime, and attendance.', 'Reports will be calculated from live tables after the supporting modules are enabled.'],
    alerts: ['Alerts & notifications', 'Expiry, service, fuel, breakdown, deviation, late arrival, and missing-log alerts.', 'Alerts will be generated from validated live records—not demo counters.'],
    grievances: ['Parent grievances', 'Receive, assign, track, resolve, and export parent concerns.', 'The secure grievance workflow is planned next with branch scope, status, and audit history.'],
    tasks: ['Employee tasks', 'Assign work, track ownership, due dates, progress, and blockers.', 'The task board will use the same employee and branch permissions as transport.'],
    access: ['Access & roles', 'Role-based employee access with branch-level data scope.', 'Group administrator access is live in the database; the management form will be enabled with the employee module.'],
  };
  function moduleMarkup(view) {
    const detail = moduleDetails[view] || ['CampusHub module', 'Secure operations workspace.', 'This module is being prepared.'];
    return header(detail[0], detail[1]) + '<section class="card live-empty"><span class="live-state-icon">✦</span><h2>Module ready for secure rollout</h2><p>' + e(detail[2]) + '</p><div class="hint"><b>Your demo design is retained.</b> The live release will replace sample rows with real branch-scoped records as this module is connected.</div></section>';
  }

  function accessMarkup() {
    if (!can('*')) return header('Access & roles', 'Role-based employee access with branch-level data scope.') + '<section class="card live-empty"><span class="live-state-icon">⌾</span><h2>Group administrator access required</h2><p>Only a group administrator can add employees and change their permissions.</p></section>';
    const branchOptions = '<option value="">Select branch</option>' + state.branches.map(item => '<option value="' + e(item.id) + '">' + e(item.name) + '</option>').join('');
    const rows = state.accessDirectory.length ? state.accessDirectory.map(item =>
      '<tr><td><b class="strong">' + e(item.full_name || 'Unnamed employee') + '</b><br><small>' + e(item.email || '—') + '</small></td>' +
      '<td>' + e(item.employee_code || '—') + '</td><td><span class="role-chip">' + e(titleRole(item.role)) + '</span></td>' +
      '<td>' + e(item.branch_name || 'All branches') + '</td><td><span class="status">' + (item.active ? 'Active' : 'Inactive') + '</span></td></tr>'
    ).join('') : '<tr><td colspan="5" class="live-table-empty">No employee access records have been added yet.</td></tr>';
    return header('Access & roles', 'Add an employee and assign their role and branch in one secure step.') +
      '<section class="card section-card access-card"><div class="section-head"><div><h2>Add employee access</h2><p>The employee must already have a CampusHub sign-in invitation. Their role and branch permissions are saved together here.</p></div></div>' +
      '<div class="hint"><b>First-time setup:</b> invite the employee email from Supabase Authentication, then enter that same email below. They can sign in immediately after the role is saved.</div>' +
      '<form id="accessForm" class="form-grid access-form"><div class="field"><label>Employee email *<input name="email" type="email" required placeholder="driver@example.com"></label></div>' +
      '<div class="field"><label>Full name *<input name="full_name" required placeholder="Employee name"></label></div>' +
      '<div class="field"><label>Employee code<input name="employee_code" placeholder="DRV-001"></label></div>' +
      '<div class="field"><label>Role *<select name="role" id="accessRole" required><option value="branch_admin">Branch admin</option><option value="transport_manager">Transport manager</option><option value="driver_attendant">Driver / attendant</option><option value="grievance_officer">Grievance officer</option><option value="task_manager">Task manager</option><option value="group_admin">Group administrator</option></select></label></div>' +
      '<div class="field"><label>Branch *<select name="branch_id" id="accessBranch" required>' + branchOptions + '</select></label></div>' +
      '<div class="form-actions full"><button class="button primary" type="submit">Save access</button></div></form></section>' +
      '<section class="card section-card"><div class="section-head"><div><h2>Employee access directory</h2><p>Each row shows the account, role, and branch scope currently granted.</p></div></div><div class="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>CODE</th><th>ROLE</th><th>BRANCH SCOPE</th><th>STATUS</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function syncAccessRole(form) {
    const role = form?.elements?.role?.value;
    const branch = form?.elements?.branch_id;
    if (!branch) return;
    const orgWide = role === 'group_admin';
    branch.disabled = orgWide;
    branch.required = !orgWide;
    if (orgWide) branch.value = '';
  }

  function branchesMarkup() {
    const rows = state.branches.length ? state.branches.map(item =>
      '<tr><td><b class="strong">' + e(item.name) + '</b></td><td>' + e(item.code || '—') + '</td><td>' +
      (item.id === state.activeBranchId ? '<span class="status">Selected</span>' : '<button class="text-button" data-live-action="select-branch" data-branch-id="' + e(item.id) + '">Use branch</button>') +
      '</td></tr>'
    ).join('') : '<tr><td colspan="3" class="live-table-empty">No branches have been configured yet.</td></tr>';
    const actions = can('*') ? '<button class="button primary" data-live-action="open-add-branch">＋ Add branch</button>' : '';
    return header('Branch management', 'Create and switch between your school branches.', actions) +
      '<section class="card section-card"><div class="section-head"><div><h2>Branches</h2><p>New branches become available to your group administrator immediately.</p></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>BRANCH NAME</th><th>CODE</th><th>ACTION</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function fleetMarkup() {
    const rows = state.buses.length ? state.buses.map(item =>
      '<tr><td><b class="strong">' + e(item.registration_number) + '</b><br><small>' + e(item.bus_code) + '</small></td>' +
      '<td>' + e(item.make_model || '—') + '</td><td>' + (item.seating_capacity == null ? '—' : e(item.seating_capacity) + ' seats') + '</td>' +
      '<td>' + fmtKm(item.current_odometer_km) + '</td><td>' + e(employeeName(item.default_driver_employee_id)) + '</td>' +
      '<td><span class="status">' + e(String(item.status || 'unknown').replaceAll('_', ' ')) + '</span></td></tr>'
    ).join('') : '<tr><td colspan="6" class="live-table-empty">No buses have been added for ' + e(branchName(state.activeBranchId)) + ' yet.</td></tr>';
    const actions = can('fleet.write') ? '<button class="button primary" data-live-action="open-add-bus">＋ Add bus</button>' : '';
    return header('Fleet', 'Live vehicle records for the selected branch.', actions) +
      '<div class="summary-strip"><div class="card"><small>Visible buses</small><strong>' + state.buses.length + '</strong><span>' + e(branchName(state.activeBranchId)) + '</span></div>' +
      '<div class="card"><small>On route</small><strong>' + state.buses.filter(item => item.status === 'on_route').length + '</strong><span>Live records only</span></div>' +
      '<div class="card"><small>In service</small><strong>' + state.buses.filter(item => item.status === 'in_service').length + '</strong><span>Awaiting return</span></div></div>' +
      '<section class="card section-card"><div class="section-head"><div><h2>Vehicle list</h2><p>Only records your account is authorised to view are shown.</p></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>VEHICLE</th><th>MAKE / MODEL</th><th>CAPACITY</th><th>ODOMETER</th><th>ASSIGNED DRIVER</th><th>STATUS</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></section>';
  }

  function driverTrips(busRecord) {
    if (state.driver.dutyPurpose && state.driver.dutyPurpose !== 'student_transport') {
      return [{ key: 'special-duty', label: dutyPurposeLabel(state.driver.dutyPurpose), kind: 'special', number: 1 }];
    }
    const mode = busRecord?.shift_mode || 'two_shifts';
    const parking = busRecord?.parking_location || 'inside_campus';
    const trips = [];
    if (mode !== 'afternoon_only') {
      if (parking === 'inside_campus') trips.push({ key: 'school-1-out', label: 'Trip 1 · Out to pick students', kind: 'to_school', number: 1 });
      trips.push({ key: 'school-1-in', label: 'Trip 1 · Incoming with students', kind: 'to_school', number: 1 });
      trips.push({ key: 'school-2-out', label: 'Trip 2 · Out to pick students', kind: 'to_school', number: 2 });
      trips.push({ key: 'school-2-in', label: 'Trip 2 · Incoming with students', kind: 'to_school', number: 2 });
    }
    if (mode !== 'morning_only') {
      trips.push({ key: 'home-1-out', label: 'Trip 1 · Out for student drop', kind: 'to_home', number: 1 });
      trips.push({ key: 'home-1-in', label: 'Trip 1 · Incoming after drop', kind: 'to_home', number: 1 });
      trips.push({ key: 'home-2-out', label: 'Trip 2 · Out for student drop', kind: 'to_home', number: 2 });
      trips.push({ key: 'home-2-in', label: 'Trip 2 · Incoming after drop', kind: 'to_home', number: 2 });
    }
    return trips;
  }
  function driverStore() {
    try { localStorage.setItem('campusHubDriverSession', JSON.stringify({ ...state.driver, watchId: null })); } catch (_) { /* private browsing can block storage */ }
  }
  function driverStopGps() {
    if (state.driver.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(state.driver.watchId);
    state.driver.watchId = null;
  }
  function driverStartGps() {
    state.driver.error = '';
    if (!navigator.geolocation) { state.driver.error = 'GPS is not available on this phone.'; renderView(); return; }
    driverStopGps();
    state.driver.watchId = navigator.geolocation.watchPosition(position => {
      state.driver.position = { latitude: position.coords.latitude, longitude: position.coords.longitude, speed: position.coords.speed == null ? null : position.coords.speed * 3.6, recordedAt: new Date().toISOString() };
      driverStore();
      renderView();
    }, error => {
      state.driver.error = error.code === 1 ? 'Location permission is needed to track this trip.' : 'GPS signal is not available yet.';
      renderView();
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
  }
  function driverAppMarkup() {
    const busRecord = bus(state.driver.busId) || state.buses[0];
    const trips = driverTrips(busRecord);
    if (busRecord && !state.driver.busId) state.driver.busId = busRecord.id;
    const started = Boolean(state.driver.sessionStartedAt);
    const current = trips[state.driver.currentTripIndex];
    const activeTrip = current && state.driver.tripTimes[current.key]?.startedAt && !state.driver.tripTimes[current.key]?.arrivedAt;
    const finished = started && !current;
    const modeText = ({ two_shifts: 'Two shifts · morning + afternoon', morning_only: 'Single shift · morning pickup', afternoon_only: 'Single shift · afternoon drop' })[busRecord?.shift_mode || 'two_shifts'];
    const busOptions = options(state.buses, item => item.bus_code + ' · ' + item.registration_number);
    let body = '';
    if (!state.buses.length) body = '<section class="card live-empty"><span class="live-state-icon">◉</span><h2>No bus assigned yet</h2><p>A manager must assign a bus to this driver before duty can start.</p></section>';
    else if (!started) body = '<section class="card driver-start-card"><div class="driver-badge">DRIVER MODE</div><h2>Start today’s duty</h2><p>Open the bus, choose the purpose, enter the starting odometer, and start GPS when the bus moves.</p><form id="driverStartForm" class="driver-form"><label>Bus<select name="bus_id" id="driverBus">' + busOptions + '</select></label><label>Duty purpose<select name="duty_purpose" id="driverDutyPurpose">' + dutyPurposeOptions(state.driver.dutyPurpose || 'student_transport') + '</select></label><div class="driver-bus-facts"><span>Shift pattern<strong id="driverShiftText">' + e(modeText) + '</strong></span><span>Parking<strong>' + e(busRecord?.parking_location === 'outside_campus' ? 'Outside campus' : 'Inside campus') + '</strong></span></div><label>Starting odometer (km)<input name="opening_odometer" type="number" min="0" step="0.1" required value="' + e(busRecord?.current_odometer_km ?? '') + '"></label><button class="button primary driver-cta" type="submit">Start duty</button></form></section>';
    else body = '<section class="card driver-live-card"><div class="driver-live-head"><div><div class="driver-badge">DUTY ACTIVE</div><h2>' + e(busRecord?.bus_code || 'Assigned bus') + '</h2><p>Purpose: <b>' + e(dutyPurposeLabel(state.driver.dutyPurpose)) + '</b><br>Opening odometer: <b>' + e(state.driver.openingOdometer) + ' km</b> · ' + e(modeText) + '</p></div><span class="gps-pill ' + (activeTrip ? 'on' : '') + '">' + (activeTrip ? '● GPS tracking' : '○ GPS waiting') + '</span></div>' +
      (state.driver.error ? '<div class="hint error-hint">' + e(state.driver.error) + '</div>' : '') +
      (state.driver.position ? '<div class="gps-readout"><span>Latitude ' + e(state.driver.position.latitude.toFixed(5)) + '</span><span>Longitude ' + e(state.driver.position.longitude.toFixed(5)) + '</span><span>' + e(state.driver.position.speed == null ? 'Speed —' : 'Speed ' + state.driver.position.speed.toFixed(1) + ' km/h') + '</span></div>' : '') +
      '<div class="driver-trip-list">' + trips.map((trip, index) => { const rec = state.driver.tripTimes[trip.key] || {}; const isCurrent = index === state.driver.currentTripIndex; const status = rec.arrivedAt ? 'Completed · ' + new Date(rec.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : rec.startedAt ? 'In progress' : isCurrent ? 'Next trip' : 'Waiting'; return '<article class="driver-trip ' + (isCurrent ? 'current' : '') + '"><div><span class="trip-number">' + (index + 1) + '</span><strong>' + e(trip.label) + '</strong><small>' + e(status) + '</small></div>' + (isCurrent && !rec.startedAt ? '<button class="button primary" data-driver-action="start-trip">Start trip</button>' : isCurrent && !rec.arrivedAt ? '<button class="button primary" data-driver-action="finish-trip">Arrived</button>' : '') + '</article>'; }).join('') + '</div>' +
      (finished ? '<div class="driver-complete"><h3>All assigned trips completed</h3><p>Enter the closing odometer when the bus is parked.</p><form id="driverCloseForm" class="driver-form"><label>Closing odometer (km)<input name="closing_odometer" type="number" min="' + e(state.driver.openingOdometer || 0) + '" step="0.1" required></label><button class="button primary driver-cta" type="submit">Close duty</button></form></div>' : '') + '</section>';
    return header('Driver app', 'A simple phone-first duty screen for starting the bus, recording trips, and tracking GPS.') + body;
  }

  function options(items, label) {
    return items.map(item => '<option value="' + e(item.id) + '">' + e(label(item)) + '</option>').join('');
  }
  function dailyMarkup() {
    const canWrite = can('daily_log.write');
    const logs = state.logs.length ? state.logs.map(log =>
      '<tr><td><b class="strong">' + e(bus(log.bus_id)?.bus_code || 'Bus') + '</b></td>' +
      '<td>' + e(dutyPurposeLabel(log.duty_purpose || 'student_transport')) + '</td><td>' + e(log.parking_location_at_start === 'outside_campus' ? 'Outside campus' : 'Inside campus') + '</td>' +
      '<td>' + fmtKm(log.opening_odometer_km) + '</td><td>' + fmtKm(log.closing_odometer_km) + '</td><td>' + fmtKm(log.total_km) + '</td>' +
      '<td>' + e(runText(log)) + '</td><td><span class="status">' + e(log.status) + '</span></td></tr>'
    ).join('') : '<tr><td colspan="8" class="live-table-empty">No daily logs for ' + e(state.serviceDate) + ' in this branch.</td></tr>';
    let form = '<section class="card live-empty"><h2>View-only access</h2><p>Your role can read daily logs but cannot submit them.</p></section>';
    if (canWrite && !state.buses.length) form = '<section class="card live-empty"><h2>Add a bus first</h2><p>A daily log can be created once this branch has a live vehicle record.</p></section>';
    if (canWrite && state.buses.length) {
      const busOptions = options(state.buses, item => item.bus_code + ' · ' + item.registration_number);
      const routes = '<option value="">No route selected</option>' + options(state.routes, item => item.route_code + ' · ' + item.name);
      const staff = '<option value="">Unassigned</option>' + options(state.employees, item => item.full_name);
      form = '<section class="card form-card"><h2>Create a four-run daily log</h2>' +
        '<p>Two morning runs bring students to school; two afternoon runs take students home. The first morning time changes with the bus parking location.</p>' +
        '<form id="dailyLogForm"><div class="form-grid">' +
        '<div class="field"><label>Bus *<select id="logBus" name="bus_id" required>' + busOptions + '</select></label></div>' +
        '<div class="field"><label>Service date *<input id="serviceDate" name="service_date" type="date" value="' + e(state.serviceDate) + '" required></label></div>' +
        '<div class="field"><label>Route<select name="route_id">' + routes + '</select></label></div>' +
        '<div class="field"><label>Bus parking location *<select id="parkingLocation" name="parking_location"><option value="inside_campus">Inside campus</option><option value="outside_campus">Outside campus</option></select></label></div>' +
        '<div class="field"><label>Duty purpose *<select id="dailyDutyPurpose" name="duty_purpose">' + dutyPurposeOptions('student_transport') + '</select></label></div>' +
        '<div class="field"><label>Shift pattern<select id="logShiftMode" disabled><option value="two_shifts">Two shifts · morning + afternoon</option><option value="morning_only">Single shift · morning pickup</option><option value="afternoon_only">Single shift · afternoon drop</option></select></label></div>' +
        '<div class="field"><label>Opening odometer *<input id="openingOdo" name="opening_odometer_km" type="number" min="0" step="0.1" required></label></div>' +
        '<div class="field"><label>Closing odometer *<input name="closing_odometer_km" type="number" min="0" step="0.1" required></label></div>' +
        '<div class="field"><label>Driver<select id="logDriver" name="driver_employee_id">' + staff + '</select></label></div>' +
        '<div class="field"><label>Attendant<select name="attendant_employee_id">' + staff + '</select></label></div>' +
        '<div id="morningShiftFields" class="form-grid full-width"><div class="field full"><label class="live-section-label">Morning — students to school</label></div>' +
        '<div class="field" id="firstRunOutField"><label id="firstRunOutLabel">Out time · School run 1 (pickup) *<input name="school_run_1_out" type="time"></label></div>' +
        '<div class="field"><label>In time · School run 1 (students arriving) *<input name="school_run_1_in" type="time" required></label></div>' +
        '<div class="field"><label>Out time · School run 2 (pickup) *<input name="school_run_2_out" type="time" required></label></div>' +
        '<div class="field"><label>In time · School run 2 (students arriving) *<input name="school_run_2_in" type="time" required></label></div></div>' +
        '<div id="afternoonShiftFields" class="form-grid full-width"><div class="field full"><label class="live-section-label">Afternoon — students home</label></div>' +
        '<div class="field"><label>Out time · Student drop 1 *<input name="home_run_1_out" type="time" required></label></div>' +
        '<div class="field"><label>In time · After drop 1 *<input name="home_run_1_in" type="time" required></label></div>' +
        '<div class="field"><label>Out time · Student drop 2 *<input name="home_run_2_out" type="time" required></label></div>' +
        '<div class="field"><label>In time · After drop 2 *<input name="home_run_2_in" type="time" required></label></div></div>' +
        '<div class="field full"><label>Remarks<textarea name="remarks" placeholder="Optional operational notes"></textarea></label></div></div>' +
        '<div class="form-actions"><button class="button primary" type="submit">Save daily log</button></div></form></section>';
    }
    return header('Daily bus log', 'Live four-run duty records for the selected branch.') +
      '<div class="form-page">' + form + '<aside class="card calc-card"><h2>Parking rule</h2>' +
      '<div class="hint" id="parkingHint"><b>Inside campus:</b> record the first school run’s out time, when the bus leaves campus for student pickup.</div>' +
      '<div class="calc-list"><div><span>Scheduled student runs</span><strong>4 runs</strong></div><div><span>Selected branch</span><strong>' +
      e(branchName(state.activeBranchId)) + '</strong></div></div></aside></div>' +
      '<section class="card section-card"><div class="section-head"><div><h2>Logs for ' + e(state.serviceDate) + '</h2><p>Distance is calculated by the database from protected odometer readings.</p></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>BUS</th><th>DUTY PURPOSE</th><th>PARKING</th><th>OPENING</th><th>CLOSING</th><th>DISTANCE</th><th>RUNS</th><th>STATUS</th></tr></thead><tbody>' +
      logs + '</tbody></table></div></section>';
  }

  function runText(log) {
    if (log.duty_purpose && log.duty_purpose !== 'student_transport') return dutyPurposeLabel(log.duty_purpose);
    const find = (kind, number) => (log.runs || []).find(run => run.run_kind === kind && run.run_number === number);
    const schoolOne = find('to_school', 1), schoolTwo = find('to_school', 2);
    const homeOne = find('to_home', 1), homeTwo = find('to_home', 2);
    const firstIn = log.parking_location_at_start === 'outside_campus';
    const run = item => (item?.departed_at || '—') + '–' + (item?.arrived_at || '—');
    return (firstIn ? 'Pickup 1 ' : 'Pickup 1 ') + run(schoolOne) + ' · Pickup 2 ' + run(schoolTwo) +
      ' · Drop 1 ' + run(homeOne) + ' · Drop 2 ' + run(homeTwo);
  }
  function setDailyDefaults() {
    const form = document.querySelector('#dailyLogForm');
    if (!form) return;
    syncDailyBus(form);
  }
  function updateParking(form) {
    if (!form) return;
    const inside = form.elements.parking_location.value === 'inside_campus';
    const firstOutField = document.querySelector('#firstRunOutField');
    const firstOut = form.elements.school_run_1_out;
    const hint = document.querySelector('#parkingHint');
    if (firstOutField) firstOutField.hidden = !inside;
    if (firstOut) { firstOut.required = inside; firstOut.disabled = !inside; if (!inside) firstOut.value = ''; }
    if (hint) hint.innerHTML = inside
      ? '<b>Inside campus:</b> Trip 1 leaves school for pickup, then returns with students. Trip 2 repeats the same out/in pattern.'
      : '<b>Outside campus:</b> Trip 1 starts with the incoming time when the bus arrives at school with students. Trip 2 records out and in.';
  }
  function updateShiftFields(form) {
    if (!form) return;
    const selected = bus(form.elements.bus_id.value);
    const mode = selected?.shift_mode || 'two_shifts';
    const morning = mode !== 'afternoon_only';
    const afternoon = mode !== 'morning_only';
    const shiftSelect = form.elements.logShiftMode;
    if (shiftSelect) shiftSelect.value = mode;
    const morningFields = form.querySelector('#morningShiftFields');
    const afternoonFields = form.querySelector('#afternoonShiftFields');
    if (morningFields) morningFields.hidden = !morning;
    if (afternoonFields) afternoonFields.hidden = !afternoon;
    ['school_run_1_in', 'school_run_2_out', 'school_run_2_in'].forEach(name => { if (form.elements[name]) form.elements[name].required = morning; });
    ['home_run_1_out', 'home_run_1_in', 'home_run_2_out', 'home_run_2_in'].forEach(name => { if (form.elements[name]) form.elements[name].required = afternoon; });
    updateParking(form);
    updateDutyPurpose(form);
  }
  function updateDutyPurpose(form) {
    if (!form) return;
    const special = form.elements.duty_purpose?.value && form.elements.duty_purpose.value !== 'student_transport';
    const morningFields = form.querySelector('#morningShiftFields');
    const afternoonFields = form.querySelector('#afternoonShiftFields');
    if (special) {
      if (morningFields) morningFields.hidden = true;
      if (afternoonFields) afternoonFields.hidden = true;
      ['school_run_1_out', 'school_run_1_in', 'school_run_2_out', 'school_run_2_in', 'home_run_1_out', 'home_run_1_in', 'home_run_2_out', 'home_run_2_in'].forEach(name => {
        if (form.elements[name]) { form.elements[name].required = false; form.elements[name].disabled = true; form.elements[name].value = ''; }
      });
      const hint = document.querySelector('#parkingHint');
      if (hint) hint.innerHTML = '<b>Special duty:</b> this log records the bus purpose and odometer movement without student pickup/drop timings.';
      const button = form.querySelector('button[type="submit"]');
      if (button) button.textContent = 'Save special duty log';
    } else {
      ['school_run_1_out', 'school_run_1_in', 'school_run_2_out', 'school_run_2_in', 'home_run_1_out', 'home_run_1_in', 'home_run_2_out', 'home_run_2_in'].forEach(name => { if (form.elements[name]) form.elements[name].disabled = false; });
      const button = form.querySelector('button[type="submit"]');
      if (button) button.textContent = 'Save daily log';
      updateParking(form);
    }
  }
  function syncDailyBus(form) {
    const selected = bus(form.elements.bus_id.value);
    if (!selected) return;
    form.elements.opening_odometer_km.value = selected.current_odometer_km == null ? '' : selected.current_odometer_km;
    form.elements.parking_location.value = selected.parking_location || 'inside_campus';
    if (selected.default_driver_employee_id) form.elements.driver_employee_id.value = selected.default_driver_employee_id;
    if (form.elements.duty_purpose) form.elements.duty_purpose.value = 'student_transport';
    updateShiftFields(form);
  }

  async function loadFleet(revision) {
    const result = await state.client.from('buses')
      .select('id, organization_id, branch_id, registration_number, bus_code, make_model, seating_capacity, current_odometer_km, fuel_tank_capacity_l, parking_location, shift_mode, status, default_driver_employee_id, active')
      .eq('organization_id', state.membership.organization_id).eq('branch_id', state.activeBranchId).order('bus_code');
    if (stale(revision)) return;
    if (result.error) throw result.error;
    state.buses = result.data || [];
  }
  async function loadDailySupport(revision) {
    const results = await Promise.all([
      state.client.from('routes').select('id, route_code, name').eq('organization_id', state.membership.organization_id).eq('branch_id', state.activeBranchId).eq('active', true).order('route_code'),
      state.client.from('employees').select('id, full_name, home_branch_id').eq('organization_id', state.membership.organization_id).eq('active', true).order('full_name'),
    ]);
    if (stale(revision)) return;
    if (results[0].error) throw results[0].error;
    if (results[1].error) throw results[1].error;
    state.routes = results[0].data || [];
    state.employees = results[1].data || [];
  }
  async function loadLogs(revision) {
    const logsResult = await state.client.from('daily_bus_logs')
      .select('id, bus_id, service_date, parking_location_at_start, duty_purpose, opening_odometer_km, closing_odometer_km, total_km, status, remarks, created_at')
      .eq('organization_id', state.membership.organization_id).eq('branch_id', state.activeBranchId).eq('service_date', state.serviceDate).order('created_at', { ascending: false });
    if (stale(revision)) return;
    if (logsResult.error) throw logsResult.error;
    const logIds = (logsResult.data || []).map(item => item.id);
    let runs = [];
    if (logIds.length) {
      const runsResult = await state.client.from('daily_bus_runs').select('log_id, run_kind, run_number, departed_at, arrived_at').in('log_id', logIds);
      if (stale(revision)) return;
      if (runsResult.error) throw runsResult.error;
      runs = runsResult.data || [];
    }
    const groups = new Map();
    runs.forEach(run => groups.set(run.log_id, [...(groups.get(run.log_id) || []), run]));
    state.logs = (logsResult.data || []).map(log => ({ ...log, runs: groups.get(log.id) || [] }));
  }
  async function loadAccessDirectory(revision) {
    if (!can('*')) return;
    const result = await state.client.rpc('get_access_directory');
    if (stale(revision)) return;
    if (result.error) throw result.error;
    state.accessDirectory = result.data || [];
  }
  async function refresh() {
    const view = state.view, revision = ++state.revision;
    shell();
    const main = document.querySelector('#liveMain');
    if (main) main.innerHTML = '<section class="card live-empty"><span class="live-spinner"></span><p>Loading authorised live records…</p></section>';
    try {
      if (view === 'daily-log') {
        await Promise.all([loadFleet(revision), loadDailySupport(revision)]);
        if (!stale(revision)) await loadLogs(revision);
      } else if (view === 'fleet' || view === 'dashboard' || view === 'driver-app') {
        await loadFleet(revision);
      } else if (view === 'access') {
        await loadAccessDirectory(revision);
      }
      if (!stale(revision)) shell();
    } catch (error) {
      if (!stale(revision)) {
        shell();
        document.querySelector('#liveMain').innerHTML = '<section class="card live-empty"><h2>Could not load live records</h2><p>' +
          e(errorText(error, 'Please try again.')) + '</p><button class="button secondary" data-live-action="refresh">Try again</button></section>';
      }
    }
  }

  async function provision(session) {
    const revision = ++state.revision;
    state.session = session;
    loadingPage('Checking your secure access');
    try {
      const userId = session.user.id;
      const start = await Promise.all([
        state.client.from('profiles').select('id, full_name, active').eq('id', userId).maybeSingle(),
        state.client.from('organization_memberships').select('id, organization_id, user_id, active').eq('user_id', userId).eq('active', true),
      ]);
      if (stale(revision)) return;
      if (start[0].error) throw start[0].error;
      if (start[1].error) throw start[1].error;
      const membership = (start[1].data || [])[0], profile = start[0].data;
      if (!profile?.active || !membership) return blockedPage('Your sign-in is valid, but a CampusHub administrator has not enabled this account yet.');
      const next = await Promise.all([
        state.client.from('member_role_scopes').select('id, branch_id, role, active').eq('membership_id', membership.id).eq('active', true),
        state.client.from('organizations').select('id, name, active').eq('id', membership.organization_id).maybeSingle(),
      ]);
      if (stale(revision)) return;
      if (next[0].error) throw next[0].error;
      if (next[1].error) throw next[1].error;
      if (!next[1].data?.active || !(next[0].data || []).length) return blockedPage('This account does not have an active CampusHub role.');
      const branchResult = await state.client.from('branches').select('id, name, code, active').eq('organization_id', membership.organization_id).eq('active', true).order('name');
      if (stale(revision)) return;
      if (branchResult.error) throw branchResult.error;
      if (!(branchResult.data || []).length) return blockedPage('This account does not have access to an active branch.');
      state.profile = profile;
      state.membership = membership;
      state.organization = next[1].data;
      state.scopes = next[0].data || [];
      state.branches = branchResult.data || [];
      if (!state.branches.some(item => item.id === state.activeBranchId)) state.activeBranchId = state.branches[0].id;
      await refresh();
    } catch (error) {
      if (!stale(revision)) blockedPage(errorText(error, 'CampusHub could not verify your account.'));
    }
  }

  async function signIn(form) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Signing in…';
    const result = await state.client.auth.signInWithPassword({
      email: text(new FormData(form).get('email')),
      password: String(new FormData(form).get('password') || ''),
    });
    if (result.error) {
      button.disabled = false;
      button.textContent = 'Sign in securely';
      notify(errorText(result.error, 'Could not sign in.'), 'error');
    }
  }
  async function signOut() {
    const result = await state.client.auth.signOut();
    if (result.error) notify(errorText(result.error, 'Could not sign out.'), 'error');
  }
  function openBusModal() {
    if (!can('fleet.write') || !branch()) return;
    modal.innerHTML = '<form id="addBusForm" class="modal-content"><div class="modal-head"><div><h2>Add a live bus record</h2><p>This bus will be stored only for ' +
      e(branchName(state.activeBranchId)) + '.</p></div><button class="close-modal" type="button" data-modal-action="close">×</button></div>' +
      '<div class="form-grid"><div class="field"><label>Registration number *<input name="registration_number" required placeholder="KA 01 AB 1234"></label></div>' +
      '<div class="field"><label>Bus code *<input name="bus_code" required placeholder="BUS-01"></label></div>' +
      '<div class="field"><label>Make / model<input name="make_model" placeholder="e.g. Tata Starbus"></label></div>' +
      '<div class="field"><label>Seating capacity<input name="seating_capacity" type="number" min="1"></label></div>' +
      '<div class="field"><label>Current odometer *<input name="current_odometer_km" type="number" min="0" step="0.1" required></label></div>' +
      '<div class="field"><label>Fuel tank capacity (L)<input name="fuel_tank_capacity_l" type="number" min="1" step="0.1"></label></div>' +
      '<div class="field"><label>Parking location *<select name="parking_location"><option value="inside_campus">Inside campus</option><option value="outside_campus">Outside campus</option></select></label></div>' +
      '<div class="field"><label>Shift pattern *<select name="shift_mode"><option value="two_shifts">Two shifts · morning + afternoon</option><option value="morning_only">Single shift · morning pickup</option><option value="afternoon_only">Single shift · afternoon drop</option></select></label></div>' +
      '<div class="field"><label>Status *<select name="status"><option value="available">Available</option><option value="on_route">On route</option><option value="in_service">In service</option><option value="inactive">Inactive</option><option value="breakdown">Breakdown</option></select></label></div></div>' +
      '<div class="form-actions"><button type="button" class="button secondary" data-modal-action="close">Cancel</button><button class="button primary" type="submit">Save bus</button></div></form>';
    modal.showModal();
  }
  function openBranchModal() {
    if (!can('*')) return;
    modal.innerHTML = '<form id="addBranchForm" class="modal-content"><div class="modal-head"><div><h2>Add a branch</h2><p>This branch will be added to ' + e(state.organization?.name || 'your school group') + '.</p></div><button class="close-modal" type="button" data-modal-action="close">×</button></div>' +
      '<div class="form-grid"><div class="field full"><label>Branch name *<input name="name" required placeholder="e.g. Sambalpur First Step"></label></div>' +
      '<div class="field"><label>Branch code<input name="code" placeholder="e.g. SFS"></label></div><div class="field"><label>Address<input name="address" placeholder="Optional campus address"></label></div></div>' +
      '<div class="form-actions"><button type="button" class="button secondary" data-modal-action="close">Cancel</button><button class="button primary" type="submit">Save branch</button></div></form>';
    modal.showModal();
  }
  async function addBranch(form) {
    if (!can('*')) return;
    const data = new FormData(form);
    const payload = { organization_id: state.membership.organization_id, name: text(data.get('name')), code: text(data.get('code'))?.toUpperCase(), address: text(data.get('address')), active: true };
    if (!payload.name) { notify('Enter a branch name.', 'error'); return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Saving…';
    // Do not request the inserted row here. The new branch is not yet visible
    // to the branch-scoped SELECT policy during PostgREST's RETURNING step.
    // Refresh immediately after the insert to load it through the normal read
    // policy and select it for the user.
    const result = await state.client.from('branches').insert(payload);
    if (result.error) {
      button.disabled = false; button.textContent = 'Save branch';
      notify(errorText(result.error, 'Could not save the branch.'), 'error');
      return;
    }
    modal.close();
    notify('Branch added. Refreshing the branch list.');
    await refresh();
  }
  async function addBus(form) {
    const data = new FormData(form);
    const payload = {
      organization_id: state.membership.organization_id, branch_id: state.activeBranchId,
      registration_number: text(data.get('registration_number')),
      bus_code: text(data.get('bus_code'))?.toUpperCase(),
      make_model: text(data.get('make_model')),
      seating_capacity: text(data.get('seating_capacity')) ? num(data.get('seating_capacity')) : null,
      current_odometer_km: num(data.get('current_odometer_km')),
      fuel_tank_capacity_l: text(data.get('fuel_tank_capacity_l')) ? num(data.get('fuel_tank_capacity_l')) : null,
      parking_location: data.get('parking_location'), shift_mode: data.get('shift_mode'), status: data.get('status'),
    };
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Saving…';
    const result = await state.client.from('buses').insert(payload);
    if (result.error) {
      button.disabled = false; button.textContent = 'Save bus';
      notify(errorText(result.error, 'Could not save the bus.'), 'error');
      return;
    }
    modal.close();
    notify('Bus saved to the selected branch.');
    await refresh();
  }
  async function saveDailyLog(form) {
    const data = new FormData(form);
    const parking = String(data.get('parking_location'));
    const dutyPurpose = text(data.get('duty_purpose')) || 'student_transport';
    const opening = num(data.get('opening_odometer_km')), closing = num(data.get('closing_odometer_km'));
    if (opening == null || closing == null || closing < opening) {
      notify('Enter a closing odometer that is at least the opening odometer.', 'error');
      return;
    }
    if (dutyPurpose !== 'student_transport') {
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true; button.textContent = 'Saving…';
      const special = await state.client.rpc('submit_special_duty_log', {
        p_bus_id: text(data.get('bus_id')), p_service_date: text(data.get('service_date')),
        p_parking_location: parking, p_opening_odometer_km: opening, p_closing_odometer_km: closing,
        p_duty_purpose: dutyPurpose, p_remarks: text(data.get('remarks')),
      });
      if (special.error) {
        button.disabled = false; button.textContent = 'Save special duty log';
        notify(errorText(special.error, 'The special duty log was not saved.'), 'error');
        return;
      }
      state.serviceDate = text(data.get('service_date')) || state.serviceDate;
      notify('Special duty log saved with its purpose and odometer readings.');
      await refresh();
      return;
    }
    const firstOut = text(data.get('school_run_1_out'));
    const firstIn = text(data.get('school_run_1_in'));
    const secondOut = text(data.get('school_run_2_out'));
    const secondIn = text(data.get('school_run_2_in'));
    const mode = bus(text(data.get('bus_id')))?.shift_mode || 'two_shifts';
    const morning = mode !== 'afternoon_only';
    const afternoon = mode !== 'morning_only';
    const required = ['bus_id', 'service_date'];
    if (morning) required.push('school_run_1_in', 'school_run_2_out', 'school_run_2_in');
    if (afternoon) required.push('home_run_1_out', 'home_run_1_in', 'home_run_2_out', 'home_run_2_in');
    if ((morning && parking === 'inside_campus' && !firstOut) || (morning && !firstIn) || (morning && !secondOut) || required.some(key => !text(data.get(key)))) {
      notify('Complete every required time and bus detail.', 'error');
      return;
    }
    const payload = {
      p_bus_id: text(data.get('bus_id')), p_service_date: text(data.get('service_date')),
      p_route_id: text(data.get('route_id')), p_driver_employee_id: text(data.get('driver_employee_id')),
      p_attendant_employee_id: text(data.get('attendant_employee_id')), p_parking_location: parking,
      p_opening_odometer_km: opening, p_closing_odometer_km: closing,
      p_school_run_1_departed_at: firstOut, p_school_run_1_arrived_at: firstIn,
      p_school_run_2_departed_at: secondOut, p_school_run_2_arrived_at: secondIn,
      p_home_run_1_departed_at: text(data.get('home_run_1_out')), p_home_run_1_arrived_at: text(data.get('home_run_1_in')),
      p_home_run_2_departed_at: text(data.get('home_run_2_out')), p_home_run_2_arrived_at: text(data.get('home_run_2_in')),
      p_remarks: text(data.get('remarks')),
    };
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Saving…';
    const result = await state.client.rpc('submit_daily_log_v2', payload);
    if (result.error) {
      button.disabled = false; button.textContent = 'Save daily log';
      notify(errorText(result.error, 'The daily log was not saved.'), 'error');
      return;
    }
    state.serviceDate = payload.p_service_date;
    notify('Four-run daily log saved. The protected odometer is updated.');
    await refresh();
  }

  function startDriverDuty(form) {
    const selectedBus = bus(form.elements.bus_id.value);
    const opening = num(form.elements.opening_odometer.value);
    if (!selectedBus || opening == null || opening < Number(selectedBus.current_odometer_km || 0)) {
      notify('Enter the current starting odometer for the selected bus.', 'error');
      return;
    }
    state.driver.busId = selectedBus.id;
    state.driver.dutyPurpose = text(form.elements.duty_purpose?.value) || 'student_transport';
    state.driver.openingOdometer = opening;
    state.driver.sessionStartedAt = new Date().toISOString();
    state.driver.currentTripIndex = 0;
    state.driver.tripTimes = {};
    state.driver.position = null;
    state.driver.error = '';
    driverStore();
    notify('Duty started. Start the first trip when the bus leaves.');
    renderView();
  }
  function startDriverTrip() {
    const selectedBus = bus(state.driver.busId);
    const trip = driverTrips(selectedBus)[state.driver.currentTripIndex];
    if (!trip) return;
    state.driver.tripTimes[trip.key] = { startedAt: new Date().toISOString() };
    driverStartGps();
    driverStore();
    notify('Trip started. GPS tracking is active.');
    renderView();
  }
  function finishDriverTrip() {
    const selectedBus = bus(state.driver.busId);
    const trip = driverTrips(selectedBus)[state.driver.currentTripIndex];
    if (!trip) return;
    state.driver.tripTimes[trip.key] = { ...(state.driver.tripTimes[trip.key] || {}), arrivedAt: new Date().toISOString() };
    driverStopGps();
    state.driver.currentTripIndex += 1;
    driverStore();
    notify('Arrival recorded.');
    renderView();
  }
  function closeDriverDuty(form) {
    const closing = num(form.elements.closing_odometer.value);
    if (closing == null || closing < Number(state.driver.openingOdometer || 0)) {
      notify('Closing odometer cannot be below the opening reading.', 'error');
      return;
    }
    driverStopGps();
    state.driver = { busId: '', sessionStartedAt: null, openingOdometer: null, currentTripIndex: 0, tripTimes: {}, position: null, watchId: null, error: '', dutyPurpose: 'student_transport' };
    try { localStorage.removeItem('campusHubDriverSession'); } catch (_) { /* ignore storage cleanup errors */ }
    notify('Duty closed and timings saved on this device.');
    renderView();
  }

  async function assignEmployeeAccess(form) {
    if (!can('*')) return;
    const data = new FormData(form);
    const role = text(data.get('role'));
    const payload = {
      p_email: text(data.get('email')),
      p_full_name: text(data.get('full_name')),
      p_employee_code: text(data.get('employee_code')),
      p_role: role,
      p_branch_id: role === 'group_admin' ? null : text(data.get('branch_id')),
    };
    if (!payload.p_email || !payload.p_full_name || (role !== 'group_admin' && !payload.p_branch_id)) {
      notify('Enter the email, name, role, and branch scope.', 'error');
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Saving…';
    const result = await state.client.rpc('assign_employee_access', payload);
    if (result.error) {
      button.disabled = false; button.textContent = 'Save access';
      notify(errorText(result.error, 'Could not save employee access.'), 'error');
      return;
    }
    notify('Employee, role, and branch access saved together.');
    await refresh();
  }

  root.addEventListener('click', event => {
    const view = event.target.closest('[data-live-view]');
    if (view) { state.view = view.dataset.liveView; refresh(); return; }
    const driverAction = event.target.closest('[data-driver-action]')?.dataset.driverAction;
    if (driverAction === 'start-trip') { startDriverTrip(); return; }
    if (driverAction === 'finish-trip') { finishDriverTrip(); return; }
    const action = event.target.closest('[data-live-action]')?.dataset.liveAction;
    if (!action) return;
    if (action === 'sign-out') signOut();
    if (action === 'open-add-bus') openBusModal();
    if (action === 'open-add-branch') openBranchModal();
    if (action === 'select-branch') { state.activeBranchId = event.target.closest('[data-branch-id]').dataset.branchId; refresh(); }
    if (action === 'refresh') refresh();
  });
  root.addEventListener('change', event => {
    if (event.target.id === 'branchSelector') { state.activeBranchId = event.target.value; refresh(); }
    if (event.target.id === 'logBus') syncDailyBus(event.target.closest('form'));
    if (event.target.id === 'driverBus') { state.driver.busId = event.target.value; renderView(); }
    if (event.target.id === 'parkingLocation') updateParking(event.target.closest('form'));
    if (event.target.id === 'dailyDutyPurpose') updateDutyPurpose(event.target.closest('form'));
    if (event.target.id === 'serviceDate') { state.serviceDate = event.target.value || state.serviceDate; refresh(); }
    if (event.target.id === 'accessRole') syncAccessRole(event.target.closest('form'));
  });
  root.addEventListener('submit', event => {
    if (event.target.id === 'signInForm') { event.preventDefault(); signIn(event.target); }
    if (event.target.id === 'dailyLogForm') { event.preventDefault(); saveDailyLog(event.target); }
    if (event.target.id === 'driverStartForm') { event.preventDefault(); startDriverDuty(event.target); }
    if (event.target.id === 'driverCloseForm') { event.preventDefault(); closeDriverDuty(event.target); }
    if (event.target.id === 'accessForm') { event.preventDefault(); assignEmployeeAccess(event.target); }
  });
  modal.addEventListener('click', event => { if (event.target.closest('[data-modal-action="close"]')) modal.close(); });
  modal.addEventListener('submit', event => { if (event.target.id === 'addBusForm') { event.preventDefault(); addBus(event.target); } });
  modal.addEventListener('submit', event => { if (event.target.id === 'addBranchForm') { event.preventDefault(); addBranch(event.target); } });

  async function init() {
    try {
      const savedDriver = JSON.parse(localStorage.getItem('campusHubDriverSession') || 'null');
      if (savedDriver?.sessionStartedAt) state.driver = { ...state.driver, ...savedDriver, watchId: null };
    } catch (_) { /* continue with a fresh driver session */ }
    if (!configured()) {
      statePage('Live connection not added yet', 'The protected database and live sign-in will be connected after the setup checks are complete.', '⌁');
      return;
    }
    state.client = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    state.client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (session) provision(session);
        else {
          state.revision += 1;
          state.session = null; state.profile = null; state.membership = null; state.organization = null;
          state.scopes = []; state.branches = []; state.buses = []; state.routes = []; state.employees = []; state.logs = []; state.accessDirectory = [];
          loginPage();
        }
      }, 0);
    });
    const result = await state.client.auth.getSession();
    if (result.error) return statePage('Live connection unavailable', 'The live session could not be started. Please refresh and try again.', '⌁');
    if (result.data.session) provision(result.data.session);
    else loginPage();
  }
  init();
})();
