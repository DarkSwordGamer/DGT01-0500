// Login & Session
let idleTimeoutTimer;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const DEPT_LABELS = {
  finance: 'งานการเงิน',
  supply: 'งานพัสดุ',
  registrar: 'งานทะเบียน',
  hr: 'งานทรัพยากรบุคคล',
  it: 'งานสารสนเทศ',
  'admin-dept': 'งานธุรการ'
};

function parseUserRole(username) {
  const u = username.toLowerCase().trim();
  if (u === 'admin') return { role: 'admin', dept: null };
  if (u.endsWith('_exec')) return { role: 'exec', dept: u.replace('_exec', '') };
  if (u.endsWith('_staff')) return { role: 'staff', dept: u.replace('_staff', '') };
  // fallback: treat as department exec
  return { role: 'exec', dept: u };
}

function initLogin() {
  const savedUser = localStorage.getItem('saved_username');
  const savedPass = localStorage.getItem('saved_password');
  if(savedUser && savedPass) {
    document.getElementById('login-username').value = savedUser;
    document.getElementById('login-password').value = savedPass;
    document.getElementById('login-remember').checked = true;
  }
}

function doLogin() {
  const user = document.getElementById('login-username').value;
  const pass = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember').checked;
  
  if (user && pass) {
    if (remember) {
      localStorage.setItem('saved_username', user);
      localStorage.setItem('saved_password', pass);
    } else {
      localStorage.removeItem('saved_username');
      localStorage.removeItem('saved_password');
    }
    const parsed = parseUserRole(user);
    localStorage.setItem('userRole', parsed.role);
    localStorage.setItem('userDept', parsed.dept || '');
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    updateHeaderBadge(user, parsed.role, parsed.dept);
    showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ ' + user);
    loadDashboardForRole();
    startIdleTimer();
  } else {
    alert('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน');
  }
}

function doLogout() {
  localStorage.removeItem('userRole');
  localStorage.removeItem('userDept');
  // clear page cache so next login gets fresh content
  Object.keys(pageCache).forEach(k => delete pageCache[k]);
  document.getElementById('profile-menu').style.display = 'none';
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('logout-page').style.display = 'flex';
  stopIdleTimer();
}

function returnToLogin() {
  document.getElementById('logout-page').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

function resetIdleTimer() {
  if(document.getElementById('app-container').style.display === 'flex') {
    startIdleTimer();
  }
}

function startIdleTimer() {
  clearTimeout(idleTimeoutTimer);
  idleTimeoutTimer = setTimeout(() => {
    doLogout();
    alert('เซสชันของคุณหมดอายุ เนื่องจากไม่มีการใช้งานเกินกำหนด กรุณาเข้าสู่ระบบใหม่');
  }, IDLE_TIMEOUT_MS);
}

function stopIdleTimer() {
  clearTimeout(idleTimeoutTimer);
}

// Track user activity to reset idle timer
['mousemove', 'keydown', 'click', 'scroll'].forEach(evt => {
  document.addEventListener(evt, resetIdleTimer);
});

document.addEventListener('DOMContentLoaded', initLogin);

const ROLE_LABELS = {
  admin: 'ผู้ดูแลระบบ',
  exec: 'ผู้บริหารหน่วยงาน',
  staff: 'บุคลากร'
};

function updateHeaderBadge(username, role, dept) {
  const badge = document.getElementById('header-dept-badge');
  const deptName = document.getElementById('header-dept-name');
  const profileRole = document.getElementById('profile-role');
  const profileDept = document.getElementById('profile-dept');

  const roleLabel = ROLE_LABELS[role] || role;
  const deptLabel = DEPT_LABELS[dept] || '';

  if (role === 'admin') {
    badge.style.display = 'block';
    badge.style.background = 'var(--danger-dim)';
    badge.style.color = 'var(--danger)';
    badge.style.borderColor = 'rgba(229,62,62,0.2)';
    deptName.textContent = '🔑 ผู้ดูแลระบบ · ทุกหน่วยงาน';
  } else {
    badge.style.display = 'block';
    if (role === 'exec') {
      badge.style.background = 'var(--info-bg)';
      badge.style.color = 'var(--info)';
      badge.style.borderColor = 'rgba(49,130,206,0.2)';
      deptName.textContent = '👔 ' + roleLabel + ' · ' + deptLabel;
    } else {
      badge.style.background = 'var(--ok-bg)';
      badge.style.color = 'var(--ok)';
      badge.style.borderColor = 'rgba(56,161,105,0.2)';
      deptName.textContent = '👤 ' + roleLabel + ' · ' + deptLabel;
    }
  }

  // Update profile dropdown
  if (profileRole) profileRole.textContent = roleLabel;
  if (profileDept) profileDept.textContent = deptLabel ? '📍 ' + deptLabel : '';
}


// Clock
function updateClock(){
  const now = new Date();
  const opts = {timeZone:'Asia/Bangkok'};
  const t = now.toLocaleTimeString('th-TH',{...opts,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const d = now.toLocaleDateString('th-TH',{...opts,weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('clock').textContent = t;
  document.getElementById('date').textContent = d;
}
updateClock(); setInterval(updateClock,1000);

// Navigation cache
const pageCache = {};

async function loadPage(page) {
  const container = document.getElementById('page-content');
  if (!container) return;
  
  if (pageCache[page]) {
    container.innerHTML = pageCache[page];
    applyDepartmentFilter();
    updateExecMetrics();
    return;
  }
  
  try {
    container.innerHTML = '<div class="empty">กำลังโหลดข้อมูล...</div>';
    const response = await fetch(page + '.html');
    if (!response.ok) throw new Error('Network response was not ok');
    const html = await response.text();
    
    // Process HTML to ensure it displays correctly
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const pageElement = tempDiv.querySelector('.page');
    if (pageElement) {
        pageElement.classList.add('active');
    }
    const processedHtml = tempDiv.innerHTML;
    
    pageCache[page] = processedHtml;
    container.innerHTML = processedHtml;
    applyDepartmentFilter();
    updateExecMetrics();
  } catch (error) {
    container.innerHTML = '<div class="empty" style="color:var(--danger)">เกิดข้อผิดพลาดในการโหลดเนื้อหา (' + error.message + ')<br>โปรดรันผ่าน Local Server (เช่น ใช้ Live Server)</div>';
  }
}

function updateExecMetrics() {
  // Works for both exec and staff dashboards
  const tbodyId = document.getElementById('risk-tbody-exec') ? 'risk-tbody-exec' : 'risk-tbody-staff';
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  let critical = 0, high = 0, tracking = 0, closed = 0;
  tbody.querySelectorAll('tr').forEach(tr => {
    if (tr.style.display === 'none') return;
    const badgeText = (tr.querySelector('td:nth-child(2) .badge')?.textContent || '').toUpperCase();
    const statusText = (tr.querySelector('td:nth-child(3) .badge')?.textContent || '').trim();
    if (statusText === 'ปิดแล้ว') { closed++; return; }
    if (badgeText.includes('CRITICAL')) critical++;
    else if (badgeText.includes('HIGH')) high++;
    else tracking++;
  });

  const prefix = document.getElementById('exec-m-critical') ? 'exec' : 'staff';
  const mc = document.getElementById(prefix + '-m-critical');
  const mh = document.getElementById(prefix + '-m-high');
  const mt = document.getElementById(prefix + '-m-tracking');
  const mcl = document.getElementById(prefix + '-m-closed');
  if (mc) mc.textContent = critical;
  if (mh) mh.textContent = high;
  if (mt) mt.textContent = tracking;
  if (mcl) mcl.textContent = closed;
}

function applyDepartmentFilter() {
  const role = localStorage.getItem('userRole');
  const dept = localStorage.getItem('userDept');
  if (!role) return;

  const elements = document.querySelectorAll('#page-content [data-dept]');
  elements.forEach(el => {
    if (role === 'admin' || dept === el.getAttribute('data-dept')) {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });

  // Update dept labels on exec/staff pages
  const deptLabel = DEPT_LABELS[dept] || dept || '';
  const execLabel = document.getElementById('exec-dept-label');
  if (execLabel) execLabel.textContent = deptLabel;
  const staffLabel = document.getElementById('staff-dept-label');
  if (staffLabel) staffLabel.textContent = deptLabel;
}

function loadDashboardForRole() {
  const role = localStorage.getItem('userRole');
  if (role === 'admin') {
    loadPage('dashboard');
  } else if (role === 'exec') {
    loadPage('dashboard_exec');
  } else {
    loadPage('dashboard_staff');
  }
}

function nav(el, page){
  if (el) {
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    el.classList.add('active');
  }
  // If navigating to dashboard, route to the correct one
  if (page === 'dashboard') {
    loadDashboardForRole();
  } else {
    loadPage(page);
  }
}

// Load dashboard by default when app is shown
document.addEventListener('DOMContentLoaded', () => {
  loadDashboardForRole();
});

// Modals
function openReassign(from, to){
  document.getElementById('from-staff').value = from;
  document.getElementById('reassign-sub').textContent = 'โอนคิวงานจาก '+from+' ไปยัง '+to;
  document.getElementById('modal-reassign').classList.add('show');
}
function openDetail(id, title, staff, levelClass, levelText, status){
  const modal = document.getElementById('modal-detail');
  if(title) modal.querySelector('div[style*="font-weight:600;font-size:14px"]').textContent = title + ' — ID:' + id;
  if(levelText) modal.querySelector('div[style*="font-size:10px"]').textContent = 'ระดับ: ' + levelText;
  const vals = modal.querySelectorAll('.rule-val');
  if(vals.length >= 4 && staff) vals[1].textContent = staff;
  if(vals.length >= 4 && status) {
    vals[3].textContent = status;
    vals[3].style.color = (levelClass==='danger') ? 'var(--danger)' : 'var(--warn)';
  }
  modal.classList.add('show');
}
function openLogDetail(time, title, desc, levelClass, levelText, resultText){
  const modal = document.getElementById('modal-log');
  document.getElementById('log-time-sub').textContent = 'เวลา '+time;
  const trs = modal.querySelectorAll('table tr');
  if(trs.length >= 6 && title) {
    trs[0].querySelector('td:nth-child(2)').innerHTML = '<span class="badge ' + levelClass + '"><span class="badge-dot"></span>' + levelText + '</span>';
    trs[1].querySelector('td:nth-child(2)').textContent = desc;
    trs[2].querySelector('td:nth-child(2)').textContent = title;
    if(resultText) trs[5].querySelector('td:nth-child(2)').textContent = resultText;
  }
  modal.classList.add('show');
}
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
function doReassign(){ closeModal('modal-reassign'); showToast('Re-assign งานเรียบร้อยแล้ว'); }

function toggleProfileMenu() {
  const menu = document.getElementById('profile-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function openForgotPassword() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('forgot-page').style.display = 'flex';
  document.getElementById('otp-page').style.display = 'none';
  document.getElementById('reset-pw-page').style.display = 'none';
}
function cancelForgot() {
  document.getElementById('forgot-page').style.display = 'none';
  document.getElementById('otp-page').style.display = 'none';
  document.getElementById('reset-pw-page').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}
function requestOTP() {
  const email = document.getElementById('forgot-input-email').value;
  if(!email) { alert('กรุณากรอกอีเมล'); return; }
  document.getElementById('forgot-page').style.display = 'none';
  document.getElementById('otp-page').style.display = 'flex';
  showToast('ส่งรหัส OTP ไปยัง ' + email + ' แล้ว');
}
function verifyOTP() {
  const otp = document.getElementById('otp-input').value;
  if(otp.length < 6) { alert('กรุณากรอกรหัส OTP ให้ครบ 6 หลัก'); return; }
  document.getElementById('otp-page').style.display = 'none';
  document.getElementById('reset-pw-page').style.display = 'flex';
}
function submitNewPassword() {
  const newPw = document.getElementById('reset-new-pw').value;
  const confirmPw = document.getElementById('reset-confirm-pw').value;
  if(newPw.length < 8) { alert('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร'); return; }
  if(newPw !== confirmPw) { alert('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
  
  cancelForgot();
  showToast('รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
}

function openChangePassword() {
  document.getElementById('profile-menu').style.display = 'none';
  document.getElementById('modal-changepw').classList.add('show');
  document.getElementById('old-pw').value = '';
  document.getElementById('new-pw').value = '';
  document.getElementById('confirm-new-pw').value = '';
}
function doChangePassword() {
  const newPw = document.getElementById('new-pw').value;
  const confirmPw = document.getElementById('confirm-new-pw').value;
  if(newPw.length < 8) { alert('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร'); return; }
  if(newPw !== confirmPw) { alert('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
  closeModal('modal-changepw');
  showToast('เปลี่ยนรหัสผ่านสำเร็จ');
}

// Click outside modal
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('show'); });
});

// Toast
let toastTimer;
function showToast(msg){
  clearTimeout(toastTimer);
  document.getElementById('toast-msg').textContent = msg;
  document.getElementById('toast').classList.add('show');
  toastTimer = setTimeout(()=>document.getElementById('toast').classList.remove('show'), 3000);
}

// Log filter
function filterLog(btn, tag){
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.log-item').forEach(item=>{
    if(tag==='all'){ item.style.display=''; return; }
    const tags = item.dataset.tags||'';
    item.style.display = tags.includes(tag) ? '' : 'none';
  });
}

// Module toggles
function toggleMod(cb, id){
  const card = cb.closest('.module-card');
  if(cb.checked){ card.classList.add('on'); showToast('เปิดใช้งาน '+id+' แล้ว'); }
  else { card.classList.remove('on'); showToast('ปิดใช้งาน '+id+' แล้ว'); }
}

// Filter Risk Table in Dashboard (supports multiple tables)
function filterRiskTable(tbodyId, searchId, filterId) {
  // fallback for the original dashboard
  tbodyId = tbodyId || 'risk-tbody';
  searchId = searchId || 'search-risk';
  filterId = filterId || 'filter-risk';

  const searchInput = document.getElementById(searchId);
  const filterSelect = document.getElementById(filterId);
  if (!searchInput || !filterSelect) return;

  const filterText = searchInput.value.toLowerCase();
  const filterLevel = filterSelect.value;
  
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const trs = tbody.querySelectorAll('tr');

  trs.forEach(tr => {
    const textContent = tr.textContent.toLowerCase();
    const levelBadge = tr.querySelector('td:nth-child(2) .badge');
    let levelMatch = true;
    
    if (filterLevel !== 'all' && levelBadge) {
      levelMatch = levelBadge.textContent.toUpperCase().includes(filterLevel);
    }
    
    // Also respect dept filter
    const role = localStorage.getItem('userRole');
    const dept = localStorage.getItem('userDept');
    let deptMatch = true;
    if (role !== 'admin' && dept && tr.dataset.dept) {
      deptMatch = tr.dataset.dept === dept;
    }
    
    if (textContent.includes(filterText) && levelMatch && deptMatch) {
      tr.style.display = '';
    } else {
      tr.style.display = 'none';
    }
  });
}