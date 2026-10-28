/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Auth & Session Module - User Session Management & Page Guards
 */

class AuthManager {
  constructor() {
    this.storage = window.storageManager;
  }

  getCurrentUser() {
    return this.storage.getCurrentUser();
  }

  getCurrentRole() {
    const user = this.getCurrentUser();
    return user ? user.role : null;
  }

  login(userId) {
    const user = this.storage.getUserById(userId);
    if (!user) {
      this.showToast('Selected user profile was not found.', 'danger');
      return false;
    }
    this.storage.setCurrentUser(user.id);
    this.showToast(`Logged in as ${user.name} (${user.role.toUpperCase()})`, 'success');
    return true;
  }

  logout() {
    this.storage.setCurrentUser(null);
    this.showToast('Logged out successfully.', 'info');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 400);
  }

  switchUser(userId) {
    const success = this.storage.setCurrentUser(userId);
    if (success) {
      const user = this.storage.getUserById(userId);
      this.showToast(`Switched active profile to ${user.name} (${user.role.toUpperCase()})`, 'info');
      setTimeout(() => {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (currentPage === 'index.html') {
          if (user.role === 'admin') window.location.href = 'admin.html';
          else if (user.role === 'manager') window.location.href = 'manager.html';
          else window.location.href = 'developer.html';
        } else {
          window.location.reload();
        }
      }, 400);
    }
  }

  switchProject(projectId) {
    this.storage.setActiveProject(projectId);
    const prj = this.storage.getProjectById(projectId);
    this.showToast(`Active project changed to: ${prj ? prj.name : projectId}`, 'info');
    setTimeout(() => {
      window.location.reload();
    }, 300);
  }

  renderNavbar(activePageKey = '') {
    if (window.navigationManager) {
      window.navigationManager.renderNavbar(activePageKey);
    }
  }

  checkPageAccess(allowedRoles = []) {
    const currentUser = this.getCurrentUser();

    // If no user is logged in
    if (!currentUser) {
      const container = document.querySelector('.container') || document.body;
      const warningHtml = `
        <div class="alert alert-warning" style="margin: 1.5rem 0; padding: 1.5rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
          <div style="font-size: 1.5rem; margin-right: 0.75rem;">🛡️</div>
          <div style="flex: 1;">
            <h3 style="font-size: 1.125rem; font-weight: 700; color: #92400e; margin-bottom: 0.5rem;">
              Authentication Required
            </h3>
            <p style="font-size: 0.875rem; color: #78350f; margin-bottom: 0.75rem;">
              No active user session found. Please log in or register your account to access this workspace.
            </p>
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <a href="index.html" class="btn btn-sm btn-primary">🔑 Go to Login / Registration</a>
            </div>
          </div>
        </div>
      `;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = warningHtml;
      container.insertBefore(wrapper.firstElementChild, container.firstChild);
      return false;
    }

    // If user role is not authorized for this page
    if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
      const container = document.querySelector('.container') || document.body;
      const warningHtml = `
        <div class="alert alert-warning" style="margin: 1.5rem 0; padding: 1.5rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
          <div style="font-size: 1.5rem; margin-right: 0.75rem;">🛡️</div>
          <div style="flex: 1;">
            <h3 style="font-size: 1.125rem; font-weight: 700; color: #92400e; margin-bottom: 0.5rem;">
              Role Access Notice
            </h3>
            <p style="font-size: 0.875rem; color: #78350f; margin-bottom: 0.75rem;">
              This workspace requires <strong>${allowedRoles.map(r => r.toUpperCase()).join(' or ')}</strong> role permissions.
              You are currently logged in as <strong>${currentUser.name} (${currentUser.role.toUpperCase()})</strong>.
            </p>
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <a href="index.html" class="btn btn-sm btn-secondary">← Switch Profile / Return to Login</a>
            </div>
          </div>
        </div>
      `;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = warningHtml;
      container.insertBefore(wrapper.firstElementChild, container.firstChild);
      return false;
    }

    return true;
  }

  showToast(message, type = 'info', title = null) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    let defaultTitle = 'Notification';
    if (type === 'success') { icon = '✅'; defaultTitle = 'Success'; }
    else if (type === 'danger') { icon = '❌'; defaultTitle = 'Error'; }
    else if (type === 'warning') { icon = '⚠️'; defaultTitle = 'Warning'; }

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-body">
        <div class="toast-title">${title || defaultTitle}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Global Singleton Instance
window.authManager = new AuthManager();
