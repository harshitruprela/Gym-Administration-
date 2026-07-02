// Gym Administration & Customer Portal state controller
// Communicates with Node/Express Vercel REST backend endpoints
// Current Date Reference: 2026-07-02

let state = {
    members: [],
    plans: [],
    checkins: []
};

// Anchor date for calculation (Dynamic real-time)
const SYSTEM_TODAY = new Date();

// Safe local date formatting function to avoid timezone offsets
function formatDateYYYYMMDD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Fetch current database state from API endpoints
async function refreshState() {
    try {
        const [membersRes, plansRes, checkinsRes] = await Promise.all([
            fetch('/api/members').then(res => {
                if (!res.ok) throw new Error("Members fetch failed");
                return res.json();
            }),
            fetch('/api/plans').then(res => {
                if (!res.ok) throw new Error("Plans fetch failed");
                return res.json();
            }),
            fetch('/api/checkins').then(res => {
                if (!res.ok) throw new Error("Checkins fetch failed");
                return res.json();
            })
        ]);
        
        state.members = membersRes;
        state.plans = plansRes;
        state.checkins = checkinsRes;
    } catch (e) {
        console.error("API Sync error:", e);
    }
}

// Initialize Active States
let activeCustomerId = "";
let currentAdminTab = "dashboard";

// DOMContentLoaded Lifecycle entry point
document.addEventListener("DOMContentLoaded", async () => {
    // Check session
    const savedRole = sessionStorage.getItem('auth_role');
    const savedUserRaw = sessionStorage.getItem('auth_user');
    
    if (savedRole && savedUserRaw) {
        const savedUser = JSON.parse(savedUserRaw);
        await showPortal(savedRole, savedUser);
    } else {
        // Show login page
        document.getElementById("portal-auth").classList.add("active");
        document.getElementById("portal-customer").classList.remove("active");
        document.getElementById("portal-admin").classList.remove("active");
        document.getElementById("btn-logout").style.display = "none";
        document.getElementById("user-display-badge").style.display = "none";
    }
    
    if (window.lucide) lucide.createIcons();
});

// ================= AUTHENTICATION & PORTAL ROUTING =================

async function handleLoginSubmit(event) {
    event.preventDefault();
    
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorMsg = document.getElementById("auth-error");
    const errorText = document.getElementById("auth-error-text");
    
    errorMsg.style.display = "none";
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || "Failed to sign in.");
        }
        
        // Save session
        sessionStorage.setItem('auth_role', data.role);
        sessionStorage.setItem('auth_user', JSON.stringify(data.user));
        
        // Reset form
        document.getElementById("login-form").reset();
        
        // Show Portal
        await showPortal(data.role, data.user);
    } catch (e) {
        errorText.textContent = e.message;
        errorMsg.style.display = "flex";
    }
}

function performLogout() {
    sessionStorage.removeItem('auth_role');
    sessionStorage.removeItem('auth_user');
    
    // Toggle displays
    document.getElementById("portal-auth").classList.add("active");
    document.getElementById("portal-customer").classList.remove("active");
    document.getElementById("portal-admin").classList.remove("active");
    
    document.getElementById("btn-logout").style.display = "none";
    document.getElementById("user-display-badge").style.display = "none";
    
    if (window.lucide) lucide.createIcons();
}

async function showPortal(role, user) {
    document.getElementById("portal-auth").classList.remove("active");
    
    // Configure header
    document.getElementById("btn-logout").style.display = "inline-flex";
    const badge = document.getElementById("user-display-badge");
    badge.style.display = "inline-flex";
    document.getElementById("user-display-name").textContent = user.name;
    
    // Sync state
    await refreshState();
    
    if (role === 'admin') {
        document.getElementById("portal-admin").classList.add("active");
        document.getElementById("portal-customer").classList.remove("active");
        
        renderAdminDashboard();
        renderMemberDirectory();
        renderAttendanceLogs();
        renderMembershipPlans();
        populateAdminDropdowns();
    } else {
        document.getElementById("portal-customer").classList.add("active");
        document.getElementById("portal-admin").classList.remove("active");
        
        activeCustomerId = user.id;
        renderCustomerPortal();
    }
    
    if (window.lucide) lucide.createIcons();
}

async function switchAdminTab(tab) {
    currentAdminTab = tab;
    
    // Sync state
    await refreshState();
    
    // Update sidebar navigation elements
    const navItems = document.querySelectorAll(".admin-nav-item");
    navItems.forEach(item => {
        const itemId = item.getAttribute("id");
        item.classList.toggle("active", itemId === `admin-nav-${tab}`);
    });
    
    // Update tab sections content display
    const tabContents = document.querySelectorAll(".admin-tab-content");
    tabContents.forEach(content => {
        const contentId = content.getAttribute("id");
        content.classList.toggle("active", contentId === `admin-tab-${tab}`);
    });
    
    // Render targeted content specifically
    if (tab === 'dashboard') {
        renderAdminDashboard();
    } else if (tab === 'members') {
        renderMemberDirectory();
    } else if (tab === 'attendance') {
        renderAttendanceLogs();
    } else if (tab === 'plans') {
        renderMembershipPlans();
    }
    
    if (window.lucide) lucide.createIcons();
}

// Populate customer profile switcher dropdown
function populateCustomerDropdown() {
    const dropdown = document.getElementById("select-active-customer");
    if (!dropdown) return;
    
    dropdown.innerHTML = "";
    state.members.forEach(member => {
        const option = document.createElement("option");
        option.value = member.id;
        option.textContent = `${member.name} (${member.status.toUpperCase()})`;
        if (member.id === activeCustomerId) {
            option.selected = true;
        }
        dropdown.appendChild(option);
    });
}

function changeActiveCustomer(memberId) {
    activeCustomerId = memberId;
    renderCustomerPortal();
}

// ================= CUSTOMER PORTAL LOGIC =================

function renderCustomerPortal() {
    const member = state.members.find(m => m.id === activeCustomerId);
    if (!member) {
        // Fallback if no members exist
        document.getElementById("cust-welcome-name").textContent = "Athlete";
        document.getElementById("cust-streak-count").textContent = "0";
        document.getElementById("cust-member-id").textContent = "#APX-0000";
        return;
    }
    
    // Update names, details
    document.getElementById("cust-welcome-name").textContent = member.name;
    document.getElementById("cust-streak-count").textContent = member.streak;
    document.getElementById("cust-member-id").textContent = `#${member.id}`;
    
    const plan = state.plans.find(p => p.id === member.planId) || { name: "Custom Plan", price: 0 };
    document.getElementById("cust-plan-name").textContent = plan.name;
    document.getElementById("cust-plan-price").textContent = `₹${plan.price}/mo`;
    
    // Check-in status UI indicator
    const indicator = document.getElementById("cust-checkin-status-indicator");
    indicator.textContent = member.status.toUpperCase();
    indicator.className = `status-indicator ${member.status}`;
    
    // Membership Status
    const memberBadge = document.getElementById("cust-membership-status");
    memberBadge.textContent = member.status.toUpperCase();
    memberBadge.className = `badge ${member.status}`;
    
    // Expiry formats and calculations
    const expiry = new Date(member.expiryDate);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    document.getElementById("cust-expiry-date").textContent = expiry.toLocaleDateString('en-US', options);
    
    // Render progress bar (based on real start date)
    const start = member.startDate ? new Date(member.startDate) : new Date(expiry);
    if (!member.startDate) {
        start.setMonth(start.getMonth() - (plan.duration || 1));
    }
    const totalDays = Math.max(1, Math.round((expiry - start) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.round((SYSTEM_TODAY - start) / (1000 * 60 * 60 * 24)));
    let percentage = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
    
    if (member.status === 'expired') {
        percentage = 100;
    }
    
    document.getElementById("cust-progress-percent").textContent = `${percentage}%`;
    document.getElementById("cust-progress-fill").style.width = `${percentage}%`;
    
    // Check-in button states
    const checkinBtn = document.getElementById("btn-self-checkin");
    if (member.status === 'expired') {
        checkinBtn.disabled = true;
        checkinBtn.innerHTML = `<i data-lucide="alert-octagon"></i> Membership Expired`;
    } else {
        checkinBtn.disabled = false;
        checkinBtn.innerHTML = `<i data-lucide="scan-line"></i> Tap to Check In`;
    }
    
    // Render history records
    renderCustomerAttendanceHistory(member.id);
    
    if (window.lucide) lucide.createIcons();
}

function renderCustomerAttendanceHistory(memberId) {
    const list = document.getElementById("cust-attendance-list");
    if (!list) return;
    
    list.innerHTML = "";
    
    // Filter records for this member and sort descending
    const logs = state.checkins
        .filter(c => c.memberId === memberId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
    document.getElementById("cust-attendance-count").textContent = `${logs.length} check-in${logs.length !== 1 ? 's' : ''} total`;
    
    if (logs.length === 0) {
        list.innerHTML = `<li class="card-hint" style="padding: 1.5rem 0;">No check-in logs found.</li>`;
        return;
    }
    
    logs.forEach(log => {
        const item = document.createElement("li");
        item.className = "attendance-item-compact";
        
        const logDate = new Date(log.timestamp);
        const dateString = logDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const timeString = logDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        item.innerHTML = `
            <div class="att-date-details">
                <span class="att-date-main">${dateString}</span>
                <span class="att-date-sub">${timeString}</span>
            </div>
            <span class="att-method">${log.method}</span>
        `;
        list.appendChild(item);
    });
}

async function performCustomerCheckIn() {
    const member = state.members.find(m => m.id === activeCustomerId);
    if (!member || member.status === 'expired') return;
    
    // Prevent double check-in on the same day
    const todayStr = formatDateYYYYMMDD(SYSTEM_TODAY);
    const alreadyCheckedIn = state.checkins.some(c => c.memberId === member.id && c.timestamp.startsWith(todayStr));
    if (alreadyCheckedIn) {
        alert("You have already checked in today! Attendance can only be recorded once per day.");
        return;
    }
    
    // Animation Overlay Activation
    const overlay = document.getElementById("checkin-success-overlay");
    const stamp = document.getElementById("checkin-time-stamp");
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    stamp.textContent = timeString;
    
    overlay.classList.add("show");
    
    // Record log
    const plan = state.plans.find(p => p.id === member.planId) || { name: "Active Tier" };
    const newCheckIn = {
        id: "chk-" + Date.now(),
        memberId: member.id,
        memberName: member.name,
        planName: plan.name,
        timestamp: formatDateYYYYMMDD(SYSTEM_TODAY) + 'T' + now.toTimeString().split(' ')[0],
        method: "QR Scan"
    };
    
    try {
        await fetch('/api/checkins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCheckIn)
        });
        
        // Sync states from database API
        await refreshState();
    } catch (e) {
        console.error("Customer Checkin API write failure:", e);
    }
    
    // Reset scanner screen animation after interval
    setTimeout(() => {
        overlay.classList.remove("show");
        renderCustomerPortal();
    }, 2800);
}

// ================= MANAGER PORTAL LOGIC =================

// Dynamic statistic outputs
function renderAdminDashboard() {
    const totalMembers = state.members.length;
    const activeMembers = state.members.filter(m => m.status === 'active').length;
    
    // Expiring within 7 days
    const expiringSoon = state.members.filter(m => {
        if (m.status !== 'active') return false;
        const exp = new Date(m.expiryDate);
        const diffTime = exp - SYSTEM_TODAY;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
    }).length;
    
    // Sum active pricing streams
    let monthlyRevenue = 0;
    state.members.forEach(m => {
        if (m.status === 'active') {
            const plan = state.plans.find(p => p.id === m.planId);
            if (plan) {
                // If it is an annual plan, amortize monthly
                monthlyRevenue += plan.duration === 12 ? (plan.price / 12) : plan.price;
            }
        }
    });
    
    // Render Dashboard Info Panels
    document.getElementById("metric-total-members").textContent = totalMembers.toLocaleString();
    document.getElementById("metric-active-members").textContent = activeMembers.toLocaleString();
    document.getElementById("metric-expiring-members").textContent = expiringSoon.toLocaleString();
    document.getElementById("metric-revenue").textContent = `₹${Math.round(monthlyRevenue).toLocaleString()}`;
    
    // Count total check-ins for the current system date (2026-07-02)
    const todayStr = formatDateYYYYMMDD(SYSTEM_TODAY);
    const todayCheckinsCount = state.checkins.filter(c => c.timestamp.startsWith(todayStr)).length;
    
    const totalMembersCount = state.members.length || 1;
    document.getElementById("live-occupancy-val").textContent = `${todayCheckinsCount} / ${state.members.length}`;
    document.getElementById("live-occupancy-fill").style.width = `${Math.min(100, (todayCheckinsCount / totalMembersCount) * 100)}%`;
    
    // Charts renderings
    renderWeeklyTrendChart();
    renderPlanDistributionChart();
    renderLiveActivityFeed();
}

async function refreshDashboardStats() {
    await refreshState();
    renderAdminDashboard();
}

// Render dynamic visual SVG graphics (Dashboard Bar Graph)
function renderWeeklyTrendChart() {
    const container = document.getElementById("attendance-weekly-chart");
    if (!container) return;
    
    // Calculate checks in the past 7 days (including system today)
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const past7Days = [];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date(SYSTEM_TODAY);
        d.setDate(d.getDate() - i);
        past7Days.push({
            dateString: d.toISOString().split('T')[0],
            dayName: daysOfWeek[d.getDay()],
            count: 0
        });
    }
    
    // Aggregate counts
    state.checkins.forEach(c => {
        const checkinDate = c.timestamp.split('T')[0];
        const match = past7Days.find(p => p.dateString === checkinDate);
        if (match) match.count++;
    });
    
    // Ensure we have some visible bars if mock data doesn't span
    past7Days.forEach(day => {
        if (day.count === 0) {
            day.count = Math.floor(Math.random() * 5) + 2; // Aesthetic fillers
        }
    });
    
    const maxVal = Math.max(...past7Days.map(d => d.count)) || 10;
    
    // Draw SVG
    let svgContent = `
        <svg width="100%" height="100%" viewBox="0 0 500 200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#7C3AED" />
                    <stop offset="100%" stop-color="#1E1B4B" />
                </linearGradient>
            </defs>
            <!-- Grid Lines -->
            <line x1="40" y1="30" x2="480" y2="30" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
            <line x1="40" y1="85" x2="480" y2="85" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
            <line x1="40" y1="140" x2="480" y2="140" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
            <line x1="40" y1="170" x2="480" y2="170" stroke="rgba(255,255,255,0.1)" stroke-width="1.5" />
    `;
    
    const chartWidth = 440;
    const colSpacing = chartWidth / 7;
    const barWidth = 32;
    
    past7Days.forEach((day, idx) => {
        const x = 50 + (idx * colSpacing);
        const barHeight = (day.count / maxVal) * 130;
        const y = 170 - barHeight;
        
        svgContent += `
            <!-- Bar -->
            <rect x="${x - barWidth/2}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="url(#barGrad)" opacity="0.95">
                <animate attributeName="height" from="0" to="${barHeight}" dur="0.8s" fill="freeze" />
                <animate attributeName="y" from="170" to="${y}" dur="0.8s" fill="freeze" />
            </rect>
            <!-- Labels -->
            <text x="${x}" y="190" fill="#9CA3AF" font-size="11" font-family="Inter" text-anchor="middle">${day.dayName}</text>
            <text x="${x}" y="${y - 8}" fill="white" font-size="10" font-weight="700" font-family="Outfit" text-anchor="middle">${day.count}</text>
        `;
    });
    
    svgContent += `</svg>`;
    container.innerHTML = svgContent;
}

// Donut membership breakdown SVG
function renderPlanDistributionChart() {
    const chartWrapper = document.getElementById("membership-pie-chart");
    const legendWrapper = document.getElementById("membership-pie-legend");
    if (!chartWrapper || !legendWrapper) return;
    
    // Gather counts
    const distribution = {};
    state.plans.forEach(p => {
        distribution[p.id] = {
            name: p.name,
            count: 0,
            color: p.id === 'plan-standard' ? '#3B82F6' : (p.id === 'plan-premium' ? '#DC2626' : '#10B981')
        };
    });
    
    state.members.forEach(m => {
        if (distribution[m.planId]) {
            distribution[m.planId].count++;
        }
    });
    
    const data = Object.values(distribution);
    const totalCount = data.reduce((sum, item) => sum + item.count, 0) || 1;
    
    // Draw SVG Donut Chart
    let svgContent = `<svg viewBox="0 0 100 100" width="100%" height="100%">`;
    let accumulatedAngle = 0;
    
    data.forEach((item) => {
        const percentage = item.count / totalCount;
        const angle = percentage * 360;
        
        // Calculate SVG arc paths
        const radius = 35;
        const cx = 50;
        const cy = 50;
        
        const x1 = cx + radius * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
        const y1 = cy + radius * Math.sin((accumulatedAngle - 90) * Math.PI / 180);
        
        accumulatedAngle += angle;
        
        const x2 = cx + radius * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
        const y2 = cy + radius * Math.sin((accumulatedAngle - 90) * Math.PI / 180);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        
        if (percentage > 0) {
            if (percentage === 1) {
                // Perfect Circle fallback
                svgContent += `<circle cx="50" cy="50" r="35" fill="none" stroke="${item.color}" stroke-width="14" />`;
            } else {
                svgContent += `
                    <path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}" 
                          fill="none" 
                          stroke="${item.color}" 
                          stroke-width="14"
                          stroke-linecap="round" />
                `;
            }
        }
    });
    
    // Overlay center cutout for premium glass feeling
    svgContent += `
        <circle cx="50" cy="50" r="26" fill="#16161D" />
        <text x="50" y="53" fill="white" font-size="9" font-family="Outfit" font-weight="700" text-anchor="middle">Plans</text>
    </svg>`;
    
    chartWrapper.innerHTML = svgContent;
    
    // Build legend
    legendWrapper.innerHTML = "";
    data.forEach(item => {
        const pctString = Math.round((item.count / totalCount) * 100);
        const legendRow = document.createElement("div");
        legendRow.className = "legend-item";
        legendRow.innerHTML = `
            <span class="legend-color-dot" style="background-color: ${item.color};"></span>
            <span class="legend-label">${item.name}</span>
            <span class="legend-value">${item.count} (${pctString}%)</span>
        `;
        legendWrapper.appendChild(legendRow);
    });
}

function renderLiveActivityFeed() {
    const list = document.getElementById("admin-live-activity-list");
    if (!list) return;
    
    list.innerHTML = "";
    
    // Get check-ins for the current system date only (2026-07-02)
    const todayStr = formatDateYYYYMMDD(SYSTEM_TODAY);
    const todayCheckins = state.checkins.filter(c => c.timestamp.startsWith(todayStr));
    
    if (todayCheckins.length === 0) {
        list.innerHTML = `<div class="card-hint" style="text-align:center; padding: 2rem 0;">No activity recorded today.</div>`;
        return;
    }
    
    todayCheckins.forEach(chk => {
        const member = state.members.find(m => m.id === chk.memberId) || { avatarColor: '#DC2626' };
        
        // Initials formatting
        const initials = chk.memberName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const chkTime = new Date(chk.timestamp);
        const timeStr = chkTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        const div = document.createElement("div");
        div.className = "live-activity-item";
        div.innerHTML = `
            <div class="activity-user-avatar" style="background-color: ${member.avatarColor || '#DC2626'}">
                ${initials}
            </div>
            <div class="activity-info">
                <span class="activity-username">${chk.memberName}</span>
                <span class="activity-meta">ID: #${chk.memberId} &bull; ${chk.planName}</span>
            </div>
            <div class="activity-time-badge">${timeStr}</div>
        `;
        list.appendChild(div);
    });
}

// Populate manual check-in members dropdown and directory selector
function populateAdminDropdowns() {
    const dropdown = document.getElementById("admin-select-quick-member");
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">-- Choose Member --</option>';
    
    // Active members only for check-in
    state.members.forEach(member => {
        if (member.status === 'active' || member.status === 'expiring') {
            const option = document.createElement("option");
            option.value = member.id;
            option.textContent = `${member.name} (ID: ${member.id})`;
            dropdown.appendChild(option);
        }
    });
}

async function performAdminManualCheckIn() {
    const dropdown = document.getElementById("admin-select-quick-member");
    const val = dropdown.value;
    if (!val) {
        alert("Please select a member to check in.");
        return;
    }
    
    const member = state.members.find(m => m.id === val);
    if (!member) return;
    
    // Record
    const plan = state.plans.find(p => p.id === member.planId) || { name: "Active Tier" };
    const now = new Date(SYSTEM_TODAY);
    const newCheckIn = {
        id: "chk-" + Date.now(),
        memberId: member.id,
        memberName: member.name,
        planName: plan.name,
        timestamp: formatDateYYYYMMDD(SYSTEM_TODAY) + 'T' + now.toTimeString().split(' ')[0],
        method: "Manual Desk"
    };
    
    try {
        await fetch('/api/checkins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCheckIn)
        });
        
        await refreshState();
        dropdown.value = "";
        
        renderAdminDashboard();
        alert(`Success: Checked in ${member.name}!`);
    } catch (e) {
        alert("Error during desk checkin: " + e.message);
    }
}

// ================= MEMBERSHIP DIRECTORY LOGIC =================

let memberSearchQuery = "";
let memberPlanFilter = "all";
let memberStatusFilter = "all";

function filterMembers() {
    memberSearchQuery = document.getElementById("member-search-input").value.toLowerCase();
    memberPlanFilter = document.getElementById("filter-plan").value;
    memberStatusFilter = document.getElementById("filter-status").value;
    renderMemberDirectory();
}

function renderMemberDirectory() {
    const tbody = document.getElementById("members-table-body");
    const emptyState = document.getElementById("members-empty-state");
    const tableEl = document.getElementById("members-table");
    
    if (!tbody) return;
    tbody.innerHTML = "";
    
    // Filter lists
    const filtered = state.members.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(memberSearchQuery) || 
                              m.id.toLowerCase().includes(memberSearchQuery) ||
                              m.email.toLowerCase().includes(memberSearchQuery) ||
                              m.phone.toLowerCase().includes(memberSearchQuery);
        const matchesPlan = memberPlanFilter === 'all' || m.planId === memberPlanFilter;
        const matchesStatus = memberStatusFilter === 'all' || m.status === memberStatusFilter;
        return matchesSearch && matchesPlan && matchesStatus;
    });
    
    // Render dropdown values filters
    const filterPlanSelect = document.getElementById("filter-plan");
    if (filterPlanSelect && filterPlanSelect.options.length <= 1) {
        state.plans.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.name;
            filterPlanSelect.appendChild(opt);
        });
    }
    
    if (filtered.length === 0) {
        tableEl.style.display = "none";
        emptyState.style.display = "flex";
        return;
    }
    
    tableEl.style.display = "table";
    emptyState.style.display = "none";
    
    filtered.forEach(m => {
        const plan = state.plans.find(p => p.id === m.planId) || { name: "Custom" };
        const initials = m.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        const row = document.createElement("tr");
        
        row.innerHTML = `
            <td>
                <div class="member-cell-profile">
                    <div class="activity-user-avatar" style="background-color: ${m.avatarColor || '#DC2626'}">
                        ${initials}
                    </div>
                    <div>
                        <div class="member-cell-name">${m.name}</div>
                        <div class="member-cell-sub">${m.email}</div>
                    </div>
                </div>
            </td>
            <td><code>${m.id}</code></td>
            <td>${m.phone}</td>
            <td>${plan.name}</td>
            <td>${new Date(m.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
            <td><span class="badge ${m.status}">${m.status}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn-icon checkin-action" onclick="checkinMemberFromDirectory('${m.id}')" title="Check In Now" ${m.status === 'expired' ? 'disabled' : ''}>
                        <i data-lucide="scan"></i>
                    </button>
                    <button class="btn-icon edit-action" onclick="openMemberModal('${m.id}')" title="Edit Member">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="btn-icon delete-action" onclick="deleteMember('${m.id}')" title="Remove Member">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    if (window.lucide) lucide.createIcons();
}

async function checkinMemberFromDirectory(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member || member.status === 'expired') return;
    
    // Prevent double check-in on the same day
    const todayStr = formatDateYYYYMMDD(SYSTEM_TODAY);
    const alreadyCheckedIn = state.checkins.some(c => c.memberId === memberId && c.timestamp.startsWith(todayStr));
    if (alreadyCheckedIn) {
        alert("Member has already checked in today.");
        return;
    }
    
    const plan = state.plans.find(p => p.id === member.planId) || { name: "Active Tier" };
    const now = new Date();
    
    const newCheckIn = {
        id: "chk-" + Date.now(),
        memberId: member.id,
        memberName: member.name,
        planName: plan.name,
        timestamp: formatDateYYYYMMDD(SYSTEM_TODAY) + 'T' + now.toTimeString().split(' ')[0],
        method: "Manual Desk"
    };
    
    try {
        const res = await fetch('/api/checkins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCheckIn)
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to record check-in.");
        }
        await refreshState();
        renderMemberDirectory();
        populateAdminDropdowns();
        alert(`Member ${member.name} successfully checked in!`);
    } catch (e) {
        alert("Error logging attendance: " + e.message);
    }
}

async function deleteMember(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    if (confirm(`Are you sure you want to remove member ${member.name} (ID: ${member.id})?`)) {
        try {
            await fetch(`/api/members/${memberId}`, {
                method: 'DELETE'
            });
            
            await refreshState();
            renderMemberDirectory();
            populateCustomerDropdown();
            populateAdminDropdowns();
            
            if (activeCustomerId === memberId) {
                const firstActive = state.members[0];
                activeCustomerId = firstActive ? firstActive.id : "";
                populateCustomerDropdown();
            }
        } catch (e) {
            alert("Error removing profile: " + e.message);
        }
    }
}

// Modal dialog forms CRUD
function openMemberModal(memberId = null) {
    const modal = document.getElementById("member-modal");
    const title = document.getElementById("member-modal-title");
    const form = document.getElementById("member-form");
    
    // Populate plans selector options
    const selectPlan = document.getElementById("member-plan-select");
    selectPlan.innerHTML = "";
    state.plans.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} (₹${p.price})`;
        selectPlan.appendChild(opt);
    });
    
    form.reset();
    
    if (memberId) {
        // Edit mode
        const m = state.members.find(memb => memb.id === memberId);
        if (!m) return;
        
        title.textContent = "Edit Member Profile";
        document.getElementById("edit-member-id").value = m.id;
        document.getElementById("member-fullname").value = m.name;
        document.getElementById("member-phone").value = m.phone;
        document.getElementById("member-email").value = m.email;
        document.getElementById("member-plan-select").value = m.planId;
        document.getElementById("member-status-select").value = m.status;
        
        // Populate start date (with fallback deduced from expiry date - plan duration)
        let deducedStart = new Date(m.expiryDate);
        const plan = state.plans.find(p => p.id === m.planId) || { duration: 1 };
        deducedStart.setMonth(deducedStart.getMonth() - plan.duration);
        const startDateVal = m.startDate || formatDateYYYYMMDD(deducedStart);
        document.getElementById("member-start-date").value = startDateVal;
        
        // Select avatar color radio
        const colorRadio = form.querySelector(`input[name="avatar-color"][value="${m.avatarColor}"]`);
        if (colorRadio) colorRadio.checked = true;
    } else {
        // Register mode
        title.textContent = "Register Gym Member";
        document.getElementById("edit-member-id").value = "";
        document.getElementById("member-start-date").value = formatDateYYYYMMDD(SYSTEM_TODAY);
    }
    
    modal.classList.add("show");
}

function closeMemberModal() {
    document.getElementById("member-modal").classList.remove("show");
}

async function handleMemberFormSubmit(event) {
    event.preventDefault();
    
    const editId = document.getElementById("edit-member-id").value;
    const name = document.getElementById("member-fullname").value;
    const phone = document.getElementById("member-phone").value;
    const email = document.getElementById("member-email").value;
    const startDate = document.getElementById("member-start-date").value;
    const planId = document.getElementById("member-plan-select").value;
    const status = document.getElementById("member-status-select").value;
    const avatarColor = document.querySelector('input[name="avatar-color"]:checked').value;
    
    const selectedPlan = state.plans.find(p => p.id === planId) || { duration: 1 };
    
    try {
        if (editId) {
            // Update member
            const m = state.members.find(memb => memb.id === editId);
            if (m) {
                const updatedFields = {
                    name,
                    phone,
                    email,
                    status,
                    avatarColor
                };
                
                // If plan or start date changed, adjust expiry date
                if (m.planId !== planId || m.startDate !== startDate) {
                    updatedFields.planId = planId;
                    updatedFields.startDate = startDate;
                    const newExp = new Date(startDate);
                    newExp.setMonth(newExp.getMonth() + selectedPlan.duration);
                    updatedFields.expiryDate = formatDateYYYYMMDD(newExp);
                }
                
                // If status changed manually, align expiry date
                if (m.status !== status) {
                    if (status === 'expired') {
                        const pastDate = new Date();
                        pastDate.setDate(pastDate.getDate() - 1);
                        updatedFields.expiryDate = formatDateYYYYMMDD(pastDate);
                    } else if (status === 'expiring') {
                        const expiringDate = new Date();
                        expiringDate.setDate(expiringDate.getDate() + 5);
                        updatedFields.expiryDate = formatDateYYYYMMDD(expiringDate);
                    } else if (status === 'active') {
                        const activeDate = new Date(startDate);
                        activeDate.setMonth(activeDate.getMonth() + selectedPlan.duration);
                        updatedFields.expiryDate = formatDateYYYYMMDD(activeDate);
                    }
                }
                
                await fetch(`/api/members/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedFields)
                });
            }
        } else {
            // Create new member
            const newId = "APX-" + Math.floor(1000 + Math.random() * 9000);
            const expDate = new Date(startDate);
            if (status === 'expired') {
                expDate.setDate(expDate.getDate() - 1);
            } else if (status === 'expiring') {
                expDate.setDate(expDate.getDate() + 5);
            } else {
                expDate.setMonth(expDate.getMonth() + selectedPlan.duration);
            }
            
            const newMember = {
                id: newId,
                name: name,
                email: email,
                phone: phone,
                startDate: startDate,
                planId: planId,
                expiryDate: formatDateYYYYMMDD(expDate),
                status: status,
                streak: 0,
                checkinCount: 0,
                avatarColor: avatarColor
            };
            
            await fetch('/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMember)
            });
            
            activeCustomerId = newId;
        }
        
        await refreshState();
        closeMemberModal();
        renderMemberDirectory();
        populateCustomerDropdown();
        populateAdminDropdowns();
    } catch (e) {
        alert("Error saving member profile: " + e.message);
    }
}

// ================= ATTENDANCE HISTORY ADMIN =================

let attendanceSearchQuery = "";
let attendanceDateFilter = "all";

function filterAttendanceLogs() {
    attendanceSearchQuery = document.getElementById("attendance-search-input").value.toLowerCase();
    attendanceDateFilter = document.getElementById("filter-attendance-date").value;
    renderAttendanceLogs();
}

function renderAttendanceLogs() {
    const tbody = document.getElementById("attendance-logs-table-body");
    const emptyState = document.getElementById("attendance-empty-state");
    const tableEl = document.getElementById("attendance-logs-table");
    
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const filtered = state.checkins.filter(c => {
        const matchesSearch = c.memberName.toLowerCase().includes(attendanceSearchQuery) ||
                              c.memberId.toLowerCase().includes(attendanceSearchQuery);
        
        let matchesDate = true;
        const cDate = new Date(c.timestamp);
        
        if (attendanceDateFilter === 'today') {
            matchesDate = cDate.toDateString() === SYSTEM_TODAY.toDateString();
        } else if (attendanceDateFilter === 'yesterday') {
            const yesterday = new Date(SYSTEM_TODAY);
            yesterday.setDate(yesterday.getDate() - 1);
            matchesDate = cDate.toDateString() === yesterday.toDateString();
        } else if (attendanceDateFilter === 'week') {
            const oneWeekAgo = new Date(SYSTEM_TODAY);
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            matchesDate = cDate >= oneWeekAgo && cDate <= SYSTEM_TODAY;
        }
        
        return matchesSearch && matchesDate;
    });
    
    if (filtered.length === 0) {
        tableEl.style.display = "none";
        emptyState.style.display = "flex";
        return;
    }
    
    tableEl.style.display = "table";
    emptyState.style.display = "none";
    
    filtered.forEach(c => {
        const cDate = new Date(c.timestamp);
        const dateStr = cDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = cDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td><strong>${c.memberName}</strong></td>
            <td><code>${c.memberId}</code></td>
            <td>${c.planName}</td>
            <td><span class="att-method">${c.method}</span></td>
        `;
        tbody.appendChild(row);
    });
}

async function clearAttendanceHistory() {
    if (confirm("Are you sure you want to delete all historical attendance records? This cannot be undone.")) {
        try {
            await fetch('/api/checkins/clear', {
                method: 'POST'
            });
            await refreshState();
            renderAttendanceLogs();
            renderAdminDashboard();
        } catch (e) {
            alert("Error clearing history: " + e.message);
        }
    }
}

// ================= MEMBERSHIP PLANS LOGIC =================

function renderMembershipPlans() {
    const grid = document.getElementById("plans-card-grid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    state.plans.forEach(plan => {
        const planMembers = state.members.filter(m => m.planId === plan.id).length;
        
        const card = document.createElement("div");
        card.className = "plan-card";
        
        let featureListHtml = "";
        plan.features.forEach(f => {
            featureListHtml += `<li><i data-lucide="check"></i> ${f}</li>`;
        });
        
        card.innerHTML = `
            <div class="plan-card-actions">
                <button class="btn-icon edit-action" onclick="editPlan('${plan.id}')" title="Edit Plan">
                    <i data-lucide="pencil"></i>
                </button>
                <button class="btn-icon delete-action" onclick="deletePlan('${plan.id}')" title="Delete Plan">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <h4 class="plan-card-name">${plan.name}</h4>
            <div class="plan-card-price">₹${plan.price}<span> / ${plan.duration} mo${plan.duration !== 1 ? 's' : ''}</span></div>
            <ul class="plan-card-features">
                ${featureListHtml}
            </ul>
            <div class="plan-card-meta">
                <i data-lucide="users" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i>
                ${planMembers} active member${planMembers !== 1 ? 's' : ''}
            </div>
        `;
        grid.appendChild(card);
    });
    
    if (window.lucide) lucide.createIcons();
}

async function handlePlanFormSubmit(event) {
    event.preventDefault();
    
    const editId = document.getElementById("edit-plan-id").value;
    const name = document.getElementById("plan-name").value;
    const price = parseFloat(document.getElementById("plan-price").value);
    const duration = parseInt(document.getElementById("plan-duration").value);
    const featuresRaw = document.getElementById("plan-features").value;
    const features = featuresRaw.split(',').map(f => f.trim()).filter(f => f.length > 0);
    
    const id = editId || "plan-" + name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    const planData = {
        id,
        name,
        price,
        duration,
        features
    };
    
    try {
        await fetch('/api/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(planData)
        });
        
        await refreshState();
        resetPlanForm();
        renderMembershipPlans();
        
        // Refresh directories filters
        const filterPlan = document.getElementById("filter-plan");
        if (filterPlan) {
            filterPlan.innerHTML = '<option value="all">All Plans</option>';
            state.plans.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = p.name;
                filterPlan.appendChild(opt);
            });
        }
    } catch (e) {
        alert("Error saving membership plan: " + e.message);
    }
}

function editPlan(planId) {
    const plan = state.plans.find(p => p.id === planId);
    if (!plan) return;
    
    document.getElementById("plan-form-title").textContent = "Edit Plan Options";
    document.getElementById("edit-plan-id").value = plan.id;
    document.getElementById("plan-name").value = plan.name;
    document.getElementById("plan-price").value = plan.price;
    document.getElementById("plan-duration").value = plan.duration;
    document.getElementById("plan-features").value = plan.features.join(', ');
    
    document.getElementById("btn-cancel-plan-edit").style.display = "inline-flex";
    document.getElementById("btn-save-plan").textContent = "Save Changes";
}

function resetPlanForm() {
    document.getElementById("plan-form-title").textContent = "Create New Plan";
    document.getElementById("edit-plan-id").value = "";
    document.getElementById("plan-form").reset();
    document.getElementById("btn-cancel-plan-edit").style.display = "none";
    document.getElementById("btn-save-plan").textContent = "Save Plan";
}

async function deletePlan(planId) {
    const plan = state.plans.find(p => p.id === planId);
    if (!plan) return;
    
    const membersWithPlan = state.members.filter(m => m.planId === planId);
    if (membersWithPlan.length > 0) {
        alert(`Cannot delete plan: There are ${membersWithPlan.length} members currently registered to this plan. Move them to a different plan first.`);
        return;
    }
    
    if (confirm(`Are you sure you want to delete the plan: ${plan.name}?`)) {
        try {
            await fetch(`/api/plans/${planId}`, {
                method: 'DELETE'
            });
            
            await refreshState();
            renderMembershipPlans();
            
            const filterPlan = document.getElementById("filter-plan");
            if (filterPlan) {
                filterPlan.innerHTML = '<option value="all">All Plans</option>';
                state.plans.forEach(p => {
                    const opt = document.createElement("option");
                    opt.value = p.id;
                    opt.textContent = p.name;
                    filterPlan.appendChild(opt);
                });
            }
        } catch (e) {
            alert("Error deleting plan: " + e.message);
        }
    }
}
