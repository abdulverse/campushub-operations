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
    logs: [], serviceDate: today(), view: 'fleet', revision: 0,
  };
  const roleCapabilities = {
    group_admin: ['*'],
    branch_admin: ['fleet.read', 'fleet.write', 'route.read', 'route.write', 'daily_log.read', 'daily_log.write', 'employee.read'],
    transport_manager: ['fleet.read', 'fleet.write', 'route.read', 'route.write', 'daily_log.read', 'daily_log.write', 'employee.read'],
    driver_attendant: ['fleet.read', 'daily_log.read'],
  };

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
      '<nav class="nav"><p class="nav-label">LIVE TRANSPORT</p>' +
      '<button class="nav-item ' + (state.view === 'fleet' ? 'active' : '') + '" data-live-view="fleet"><span>▱</span><b>Fleet</b></button>' +
      '<button class="nav-item ' + (state.view === 'daily-log' ? 'active' : '') + '" data-live-view="daily-log"><span>▤</span><b>Daily log</b></button>' +
      (can('*') ? '<button class="nav-item ' + (state.view === 'branches' ? 'active' : '') + '" data-live-view="branches"><span>⌘</span><b>Branches</b></button>' : '') +
      '<p class="nav-label">NEXT MODULES</p><span class="nav-item nav-disabled"><span>◉</span><b>Parent grievances</b></span>' +
      '<span class="nav-item nav-disabled"><span>✓</span><b>Employee tasks</b></span>' +
      '<span class="nav-item nav-disabled"><span>⌖</span><b>Tracking & reports</b></span></nav>' +
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
    main.innerHTML = state.view === 'daily-log' ? dailyMarkup() : state.view === 'branches' ? branchesMarkup() : fleetMarkup();
    if (state.view === 'daily-log') setDailyDefaults();
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

  function options(items, label) {
    return items.map(item => '<option value="' + e(item.id) + '">' + e(label(item)) + '</option>').join('');
  }
  function dailyMarkup() {
    const canWrite = can('daily_log.write');
    const logs = state.logs.length ? state.logs.map(log =>
      '<tr><td><b class="strong">' + e(bus(log.bus_id)?.bus_code || 'Bus') + '</b></td>' +
      '<td>' + e(log.parking_location_at_start === 'outside_campus' ? 'Outside campus' : 'Inside campus') + '</td>' +
      '<td>' + fmtKm(log.opening_odometer_km) + '</td><td>' + fmtKm(log.closing_odometer_km) + '</td><td>' + fmtKm(log.total_km) + '</td>' +
      '<td>' + e(runText(log)) + '</td><td><span class="status">' + e(log.status) + '</span></td></tr>'
    ).join('') : '<tr><td colspan="7" class="live-table-empty">No daily logs for ' + e(state.serviceDate) + ' in this branch.</td></tr>';
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
        '<div class="field"><label>Opening odometer *<input id="openingOdo" name="opening_odometer_km" type="number" min="0" step="0.1" required></label></div>' +
        '<div class="field"><label>Closing odometer *<input name="closing_odometer_km" type="number" min="0" step="0.1" required></label></div>' +
        '<div class="field"><label>Driver<select id="logDriver" name="driver_employee_id">' + staff + '</select></label></div>' +
        '<div class="field"><label>Attendant<select name="attendant_employee_id">' + staff + '</select></label></div>' +
        '<div class="field full"><label class="live-section-label">Morning — students to school</label></div>' +
        '<div class="field"><label id="firstRunLabel">Out time · School run 1 *<input name="school_run_1_time" type="time" required></label></div>' +
        '<div class="field"><label>In time · School run 2 *<input name="school_run_2_in" type="time" required></label></div>' +
        '<div class="field full"><label class="live-section-label">Afternoon — students home</label></div>' +
        '<div class="field"><label>Out time · Home run 1 *<input name="home_run_1_out" type="time" required></label></div>' +
        '<div class="field"><label>In time · Home run 1 *<input name="home_run_1_in" type="time" required></label></div>' +
        '<div class="field"><label>Out time · Home run 2 *<input name="home_run_2_out" type="time" required></label></div>' +
        '<div class="field"><label>In time · Home run 2 *<input name="home_run_2_in" type="time" required></label></div>' +
        '<div class="field full"><label>Remarks<textarea name="remarks" placeholder="Optional operational notes"></textarea></label></div></div>' +
        '<div class="form-actions"><button class="button primary" type="submit">Save daily log</button></div></form></section>';
    }
    return header('Daily bus log', 'Live four-run duty records for the selected branch.') +
      '<div class="form-page">' + form + '<aside class="card calc-card"><h2>Parking rule</h2>' +
      '<div class="hint" id="parkingHint"><b>Inside campus:</b> record the first school run’s out time, when the bus leaves campus for student pickup.</div>' +
      '<div class="calc-list"><div><span>Scheduled student runs</span><strong>4 runs</strong></div><div><span>Selected branch</span><strong>' +
      e(branchName(state.activeBranchId)) + '</strong></div></div></aside></div>' +
      '<section class="card section-card"><div class="section-head"><div><h2>Logs for ' + e(state.serviceDate) + '</h2><p>Distance is calculated by the database from protected odometer readings.</p></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>BUS</th><th>PARKING</th><th>OPENING</th><th>CLOSING</th><th>DISTANCE</th><th>RUNS</th><th>STATUS</th></tr></thead><tbody>' +
      logs + '</tbody></table></div></section>';
  }

  function runText(log) {
    const find = (kind, number) => (log.runs || []).find(run => run.run_kind === kind && run.run_number === number);
    const schoolOne = find('to_school', 1), schoolTwo = find('to_school', 2);
    const homeOne = find('to_home', 1), homeTwo = find('to_home', 2);
    const firstIn = log.parking_location_at_start === 'outside_campus';
    return (firstIn ? 'In ' + (schoolOne?.arrived_at || '—') : 'Out ' + (schoolOne?.departed_at || '—')) +
      ' · In ' + (schoolTwo?.arrived_at || '—') + ' · Home ' + (homeOne?.departed_at || '—') + '–' +
      (homeOne?.arrived_at || '—') + ' / ' + (homeTwo?.departed_at || '—') + '–' + (homeTwo?.arrived_at || '—');
  }
  function setDailyDefaults() {
    const form = document.querySelector('#dailyLogForm');
    if (!form) return;
    syncDailyBus(form);
  }
  function updateParking(form) {
    if (!form) return;
    const inside = form.elements.parking_location.value === 'inside_campus';
    const label = document.querySelector('#firstRunLabel');
    const hint = document.querySelector('#parkingHint');
    if (label) label.firstChild.textContent = inside ? 'Out time · School run 1 *' : 'In time · School run 1 *';
    if (hint) hint.innerHTML = inside
      ? '<b>Inside campus:</b> record the first school run’s out time, when the bus leaves campus for student pickup.'
      : '<b>Outside campus:</b> record the first school run’s in time, when the bus arrives at school with students.';
  }
  function syncDailyBus(form) {
    const selected = bus(form.elements.bus_id.value);
    if (!selected) return;
    form.elements.opening_odometer_km.value = selected.current_odometer_km == null ? '' : selected.current_odometer_km;
    form.elements.parking_location.value = selected.parking_location || 'inside_campus';
    if (selected.default_driver_employee_id) form.elements.driver_employee_id.value = selected.default_driver_employee_id;
    updateParking(form);
  }

  async function loadFleet(revision) {
    const result = await state.client.from('buses')
      .select('id, organization_id, branch_id, registration_number, bus_code, make_model, seating_capacity, current_odometer_km, fuel_tank_capacity_l, parking_location, status, default_driver_employee_id, active')
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
      .select('id, bus_id, service_date, parking_location_at_start, opening_odometer_km, closing_odometer_km, total_km, status, remarks, created_at')
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
  async function refresh() {
    const view = state.view, revision = ++state.revision;
    shell();
    const main = document.querySelector('#liveMain');
    if (main) main.innerHTML = '<section class="card live-empty"><span class="live-spinner"></span><p>Loading authorised live records…</p></section>';
    try {
      if (view === 'daily-log') {
        await Promise.all([loadFleet(revision), loadDailySupport(revision)]);
        if (!stale(revision)) await loadLogs(revision);
      } else {
        await loadFleet(revision);
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
    const result = await state.client.from('branches').insert(payload).select('id, name, code, address, active').single();
    if (result.error) {
      button.disabled = false; button.textContent = 'Save branch';
      notify(errorText(result.error, 'Could not save the branch.'), 'error');
      return;
    }
    state.branches = [...state.branches, result.data].sort((a, b) => a.name.localeCompare(b.name));
    state.activeBranchId = result.data.id;
    modal.close();
    notify('Branch added. It is now selected.');
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
      parking_location: data.get('parking_location'), status: data.get('status'),
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
    const opening = num(data.get('opening_odometer_km')), closing = num(data.get('closing_odometer_km'));
    if (opening == null || closing == null || closing < opening) {
      notify('Enter a closing odometer that is at least the opening odometer.', 'error');
      return;
    }
    const first = text(data.get('school_run_1_time'));
    const required = ['bus_id', 'service_date', 'school_run_2_in', 'home_run_1_out', 'home_run_1_in', 'home_run_2_out', 'home_run_2_in'];
    if (!first || required.some(key => !text(data.get(key)))) {
      notify('Complete every required time and bus detail.', 'error');
      return;
    }
    const payload = {
      p_bus_id: text(data.get('bus_id')), p_service_date: text(data.get('service_date')),
      p_route_id: text(data.get('route_id')), p_driver_employee_id: text(data.get('driver_employee_id')),
      p_attendant_employee_id: text(data.get('attendant_employee_id')), p_parking_location: parking,
      p_opening_odometer_km: opening, p_closing_odometer_km: closing,
      p_school_run_1_departed_at: parking === 'inside_campus' ? first : null,
      p_school_run_1_arrived_at: parking === 'outside_campus' ? first : null,
      p_school_run_2_arrived_at: text(data.get('school_run_2_in')),
      p_home_run_1_departed_at: text(data.get('home_run_1_out')), p_home_run_1_arrived_at: text(data.get('home_run_1_in')),
      p_home_run_2_departed_at: text(data.get('home_run_2_out')), p_home_run_2_arrived_at: text(data.get('home_run_2_in')),
      p_remarks: text(data.get('remarks')),
    };
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Saving…';
    const result = await state.client.rpc('submit_daily_log', payload);
    if (result.error) {
      button.disabled = false; button.textContent = 'Save daily log';
      notify(errorText(result.error, 'The daily log was not saved.'), 'error');
      return;
    }
    state.serviceDate = payload.p_service_date;
    notify('Four-run daily log saved. The protected odometer is updated.');
    await refresh();
  }

  root.addEventListener('click', event => {
    const view = event.target.closest('[data-live-view]');
    if (view) { state.view = view.dataset.liveView; refresh(); return; }
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
    if (event.target.id === 'parkingLocation') updateParking(event.target.closest('form'));
    if (event.target.id === 'serviceDate') { state.serviceDate = event.target.value || state.serviceDate; refresh(); }
  });
  root.addEventListener('submit', event => {
    if (event.target.id === 'signInForm') { event.preventDefault(); signIn(event.target); }
    if (event.target.id === 'dailyLogForm') { event.preventDefault(); saveDailyLog(event.target); }
  });
  modal.addEventListener('click', event => { if (event.target.closest('[data-modal-action="close"]')) modal.close(); });
  modal.addEventListener('submit', event => { if (event.target.id === 'addBusForm') { event.preventDefault(); addBus(event.target); } });
  modal.addEventListener('submit', event => { if (event.target.id === 'addBranchForm') { event.preventDefault(); addBranch(event.target); } });

  async function init() {
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
          state.scopes = []; state.branches = []; state.buses = []; state.routes = []; state.employees = []; state.logs = [];
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
