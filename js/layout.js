import { getCurrentUser, logout, getStoredTheme, setStoredTheme } from './data.js';

// --- Auth Guard Check ---
function checkAuth() {
  const currentUser = getCurrentUser();
  const path = window.location.pathname;
  const isAuthPage = path.includes('login.html') || path.includes('register.html');

  if (!currentUser && !isAuthPage) {
    window.location.href = 'login.html';
  } else if (currentUser && isAuthPage) {
    redirectUser(currentUser.role);
  }
}

export function redirectUser(role) {
  if (role === 'student') {
    window.location.href = 'student-dashboard.html';
  } else if (role === 'organizer') {
    window.location.href = 'organizer-dashboard.html';
  } else if (role === 'volunteer') {
    window.location.href = 'volunteer-dashboard.html';
  } else {
    window.location.href = 'events.html';
  }
}

// --- Theme Management ---
export function initTheme() {
  const storedTheme = getStoredTheme();
  document.documentElement.setAttribute('data-theme', storedTheme);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  setStoredTheme(newTheme);
  updateThemeIcons(newTheme);
  showToast(`Switched to ${newTheme} mode`, 'info', 1800);
}

function updateThemeIcons(theme) {
  const icons = document.querySelectorAll('.theme-toggle-icon');
  icons.forEach(el => {
    el.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
}

// --- Toast Notification API ---
export function showToast(message, type = 'info', duration = 3200) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span style="font-weight: 700; font-size: 16px;">${iconMap[type] || 'ℹ'}</span>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, duration);
}

// --- Custom Modern Confirm Dialog API ---
export function showConfirm(title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false) {
  let modal = document.getElementById('cf-confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cf-confirm-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 420px; text-align: center;">
        <h3 id="cf-confirm-title" style="margin-bottom: var(--space-8);">Confirm Action</h3>
        <p id="cf-confirm-msg" class="text-sm text-muted mb-24">Are you sure?</p>
        <div class="flex-gap-12" style="justify-content: center;">
          <button id="cf-confirm-cancel" class="btn btn-secondary" style="flex: 1;">Cancel</button>
          <button id="cf-confirm-ok" class="btn btn-primary" style="flex: 1;">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const titleEl = document.getElementById('cf-confirm-title');
  const msgEl = document.getElementById('cf-confirm-msg');
  const okBtn = document.getElementById('cf-confirm-ok');
  const cancelBtn = document.getElementById('cf-confirm-cancel');

  titleEl.textContent = title;
  msgEl.textContent = message;
  okBtn.textContent = confirmText;
  cancelBtn.textContent = cancelText;

  if (isDanger) {
    okBtn.className = 'btn btn-danger';
  } else {
    okBtn.className = 'btn btn-primary';
  }

  modal.classList.add('active');

  const close = () => {
    modal.classList.remove('active');
  };

  const newOkBtn = okBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newOkBtn.addEventListener('click', () => {
    close();
    if (onConfirm) onConfirm();
  });

  newCancelBtn.addEventListener('click', close);
  modal.onclick = (e) => {
    if (e.target === modal) close();
  };
}

// --- Render Header Layout ---
export function renderHeader() {
  const headerContainer = document.getElementById('app-header');
  if (!headerContainer) return;

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const themeIcon = currentTheme === 'dark' ? '☀️' : '🌙';

  headerContainer.innerHTML = `
    <div class="flex-row-between" style="width: 100%; gap: var(--space-16);">
      <!-- Left side: Mobile Hamburger Toggle + Brand or Page Role -->
      <div class="flex-gap-12" style="align-items: center;">
        <button id="mobile-menu-toggle" class="btn-icon" style="display: none;" title="Toggle Navigation">
          <span style="font-size: 18px; line-height: 1;">☰</span>
        </button>

        <div class="flex-gap-8" style="align-items: center;">
          <span class="badge ${getRoleBadgeClass(currentUser.role)}">${capitalize(currentUser.role)}</span>
        </div>
      </div>

      <!-- Right side: Theme Toggle + User Info + Logout -->
      <div class="flex-gap-12" style="align-items: center;">
        <button id="theme-toggle-btn" class="btn-icon" title="Toggle Dark/Light Mode">
          <span class="theme-toggle-icon" style="font-size: 16px;">${themeIcon}</span>
        </button>

        <span class="font-medium text-sm text-muted" style="display: inline-block; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${currentUser.name}
        </span>

        <button id="logout-btn" class="btn btn-secondary btn-sm" title="Log Out">
          Logout
        </button>
      </div>
    </div>
  `;

  // Dynamic CSS to show hamburger only on mobile
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @media (max-width: 768px) {
      #mobile-menu-toggle { display: inline-flex !important; }
    }
  `;
  document.head.appendChild(styleEl);

  // Hook Theme Toggle
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

  // Hook Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    showConfirm('Sign Out', 'Are you sure you want to log out of your session?', () => {
      logout();
      window.location.href = 'login.html';
    });
  });

  // Hook Mobile Menu Toggle
  const menuToggle = document.getElementById('mobile-menu-toggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleMobileDrawer);
  }
}

// --- Render Sidebar & Mobile Navigation Layout ---
export function renderSidebar() {
  const sidebarContainer = document.getElementById('app-sidebar');
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const currentPath = window.location.pathname;

  let navItems = [
    { name: 'Explore Events', url: 'events.html', icon: '🎪' },
    { name: 'Event Schedule', url: 'schedule.html', icon: '📅' }
  ];

  if (currentUser.role === 'student') {
    navItems.unshift({ name: 'My Dashboard', url: 'student-dashboard.html', icon: '🎓' });
  } else if (currentUser.role === 'organizer') {
    navItems.unshift({ name: 'Organizer Panel', url: 'organizer-dashboard.html', icon: '⚡' });
  } else if (currentUser.role === 'volunteer') {
    navItems.unshift({ name: 'Volunteer Panel', url: 'volunteer-dashboard.html', icon: '🛡️' });
  }

  const navLinksHTML = navItems.map(item => {
    const isActive = currentPath.includes(item.url);
    return `
      <li>
        <a href="${item.url}" class="nav-link ${isActive ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.name}</span>
        </a>
      </li>
    `;
  }).join('');

  if (sidebarContainer) {
    sidebarContainer.innerHTML = `
      <a href="${navItems[0].url}" class="sidebar-brand">
        <div class="brand-icon">CF</div>
        <div class="brand-text">
          <h3>CampusFlow</h3>
          <p class="text-xs text-muted">College Events Portal</p>
        </div>
      </a>
      
      <nav style="margin-top: var(--space-12); flex-grow: 1;">
        <ul class="nav-list">
          ${navLinksHTML}
        </ul>
      </nav>

      <div class="card" style="padding: var(--space-12); background: var(--bg-surface); border: none;">
        <div class="flex-row-between">
          <span class="text-xs text-muted">v2.0 • 2026</span>
          <span class="badge badge-success text-xs">Live</span>
        </div>
      </div>
    `;
  }

  renderMobileComponents(navItems, currentPath, currentUser);
}

function renderMobileComponents(navItems, currentPath, currentUser) {
  // 1. Mobile Bottom Bar
  let bottomNav = document.getElementById('mobile-bottom-nav');
  if (!bottomNav) {
    bottomNav = document.createElement('nav');
    bottomNav.id = 'mobile-bottom-nav';
    bottomNav.className = 'mobile-bottom-nav';
    document.body.appendChild(bottomNav);
  }

  bottomNav.innerHTML = navItems.map(item => {
    const isActive = currentPath.includes(item.url);
    return `
      <a href="${item.url}" class="mobile-nav-item ${isActive ? 'active' : ''}">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.name.replace('Organizer ', '').replace('Volunteer ', '').replace('My ', '')}</span>
      </a>
    `;
  }).join('');

  // 2. Mobile Slide-out Drawer
  let drawer = document.getElementById('mobile-drawer-root');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'mobile-drawer-root';
    document.body.appendChild(drawer);
  }

  const drawerNavLinks = navItems.map(item => {
    const isActive = currentPath.includes(item.url);
    return `
      <li>
        <a href="${item.url}" class="nav-link ${isActive ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.name}</span>
        </a>
      </li>
    `;
  }).join('');

  drawer.innerHTML = `
    <div id="drawer-backdrop" class="drawer-backdrop"></div>
    <div id="drawer-panel" class="mobile-drawer">
      <div class="flex-row-between">
        <div class="sidebar-brand" style="padding: 0;">
          <div class="brand-icon">CF</div>
          <div class="brand-text">
            <h3>CampusFlow</h3>
          </div>
        </div>
        <button id="close-drawer-btn" class="btn-icon" style="border: none;">✕</button>
      </div>

      <div class="card" style="padding: var(--space-12); background: var(--bg-surface);">
        <p class="text-xs text-muted">Signed in as</p>
        <p class="font-semibold text-sm" style="margin-top: 2px;">${currentUser.name}</p>
        <span class="badge ${getRoleBadgeClass(currentUser.role)} mt-4 text-xs">${capitalize(currentUser.role)}</span>
      </div>

      <nav style="flex-grow: 1;">
        <ul class="nav-list">
          ${drawerNavLinks}
        </ul>
      </nav>

      <div style="border-top: 1px solid var(--border-color); padding-top: var(--space-16);" class="flex-col flex-gap-12">
        <button id="drawer-theme-btn" class="btn btn-secondary w-full" style="justify-content: flex-start;">
          <span class="theme-toggle-icon">🌙</span> Toggle Theme
        </button>
        <button id="drawer-logout-btn" class="btn btn-danger w-full">
          Sign Out
        </button>
      </div>
    </div>
  `;

  document.getElementById('drawer-backdrop').addEventListener('click', toggleMobileDrawer);
  document.getElementById('close-drawer-btn').addEventListener('click', toggleMobileDrawer);
  document.getElementById('drawer-theme-btn').addEventListener('click', toggleTheme);
  document.getElementById('drawer-logout-btn').addEventListener('click', () => {
    showConfirm('Sign Out', 'Are you sure you want to log out?', () => {
      logout();
      window.location.href = 'login.html';
    });
  });
}

function toggleMobileDrawer() {
  const backdrop = document.getElementById('drawer-backdrop');
  const panel = document.getElementById('drawer-panel');
  if (backdrop && panel) {
    const isOpen = panel.classList.contains('active');
    if (isOpen) {
      backdrop.classList.remove('active');
      panel.classList.remove('active');
    } else {
      backdrop.classList.add('active');
      panel.classList.add('active');
    }
  }
}

function getRoleBadgeClass(role) {
  switch (role) {
    case 'student': return 'badge-primary';
    case 'organizer': return 'badge-success';
    case 'volunteer': return 'badge-warning';
    default: return 'badge-default';
  }
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Initialize layout on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuth();
  renderHeader();
  renderSidebar();
});
