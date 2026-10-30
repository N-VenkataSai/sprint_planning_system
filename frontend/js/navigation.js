/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Navigation Module - Centralized Navigation & Header Bar
 */

class NavigationManager {
  constructor() {
    this.storage = window.storageManager;
    this.auth = window.authManager;
  }

  renderNavbar(activePageKey = '') {
    const navbarMount = document.getElementById('navbar-container');
    if (!navbarMount) return;

    const currentUser = this.auth.getCurrentUser();
    const allUsers = this.storage.getUsers();
    const allProjects = this.storage.getProjects();
    const activeProjectId = this.storage.getActiveProjectId();

    // If no user is logged in, show simple visitor header
    if (!currentUser) {
      navbarMount.innerHTML = `
        <nav class="navbar">
          <div class="nav-container">
            <a href="index.html" class="nav-brand">
              <div class="brand-icon">⚡</div>
              <div>
                <div class="brand-title">SprintAlloc</div>
                <span class="brand-tag">Sprint Planning &amp; Resource Allocation</span>
              </div>
            </a>
            <div class="nav-actions">
              <a href="index.html" class="btn btn-sm btn-primary">🔑 Login / Register</a>
            </div>
          </div>
        </nav>
      `;
      return;
    }

    // Role-specific primary links
    let navLinksHtml = '';
    if (currentUser.role === 'admin') {
      navLinksHtml = `
        <li><a href="admin.html" class="nav-link ${activePageKey === 'admin' ? 'active' : ''}">👑 Admin Center</a></li>
        <li><a href="manager.html" class="nav-link ${activePageKey === 'manager' ? 'active' : ''}">📋 PM Backlog</a></li>
        <li><a href="sprint-planning.html" class="nav-link ${activePageKey === 'sprint-planning' ? 'active' : ''}">🎯 Sprints &amp; Allocation</a></li>
        <li><a href="developer.html" class="nav-link ${activePageKey === 'developer' ? 'active' : ''}">💻 Dev Board</a></li>
        <li><a href="analytics.html" class="nav-link ${activePageKey === 'analytics' ? 'active' : ''}">📈 Analytics</a></li>
      `;
    } else if (currentUser.role === 'manager') {
      navLinksHtml = `
        <li><a href="manager.html" class="nav-link ${activePageKey === 'manager' ? 'active' : ''}">📋 PM Dashboard</a></li>
        <li><a href="sprint-planning.html" class="nav-link ${activePageKey === 'sprint-planning' ? 'active' : ''}">🎯 Sprint Planning</a></li>
        <li><a href="developer.html" class="nav-link ${activePageKey === 'developer' ? 'active' : ''}">💻 Dev Board</a></li>
        <li><a href="create-task.html" class="nav-link ${activePageKey === 'create-task' ? 'active' : ''}">➕ New Task</a></li>
        <li><a href="analytics.html" class="nav-link ${activePageKey === 'analytics' ? 'active' : ''}">📈 Analytics</a></li>
      `;
    } else {
      // Developer
      navLinksHtml = `
        <li><a href="developer.html" class="nav-link ${activePageKey === 'developer' ? 'active' : ''}">💻 My Tasks</a></li>
        <li><a href="sprint-planning.html" class="nav-link ${activePageKey === 'sprint-planning' ? 'active' : ''}">🎯 Sprint Scope</a></li>
        <li><a href="analytics.html" class="nav-link ${activePageKey === 'analytics' ? 'active' : ''}">📈 Analytics</a></li>
      `;
    }

    const roleClass = `role-${currentUser.role}`;

    // Project selector options: only real projects
    let projectSelectorHtml = '';
    if (allProjects.length > 0) {
      projectSelectorHtml = `
        <div class="nav-select-wrapper">
          <span class="nav-select-label">Project:</span>
          <select class="nav-select" id="nav-project-select" onchange="window.authManager.switchProject(this.value)">
            ${allProjects.map(p => `
              <option value="${p.id}" ${p.id === activeProjectId ? 'selected' : ''}>
                ${p.id} - ${p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name}
              </option>
            `).join('')}
          </select>
        </div>
      `;
    } else {
      projectSelectorHtml = `
        <div class="nav-select-wrapper">
          <span class="nav-select-label" style="font-style: italic;">No projects yet</span>
        </div>
      `;
    }

    // Role switcher dropdown: only registered users
    let userSwitcherOptions = '';
    if (allUsers.length > 1) {
      userSwitcherOptions = `
        <select class="nav-select" style="margin-left: 0.25rem; font-size: 0.75rem; padding: 0.2rem 0.4rem;" onchange="window.authManager.switchUser(this.value)" title="Switch active registered user">
          ${allUsers.map(u => `
            <option value="${u.id}" ${u.id === currentUser.id ? 'selected' : ''}>
              ${u.name} (${u.role.toUpperCase()})
            </option>
          `).join('')}
        </select>
      `;
    }

    navbarMount.innerHTML = `
      <nav class="navbar">
        <div class="nav-container">
          <a href="index.html" class="nav-brand">
            <div class="brand-icon">⚡</div>
            <div>
              <div class="brand-title">SprintAlloc</div>
              <span class="brand-tag">Sprint Planning &amp; Resource Allocation</span>
            </div>
          </a>

          <ul class="nav-menu">
            ${navLinksHtml}
          </ul>

          <div class="nav-actions">
            ${projectSelectorHtml}

            <!-- User profile badge -->
            <div class="user-profile-badge">
              <div class="user-avatar">${currentUser.avatar || 'U'}</div>
              <div class="user-info">
                <span class="user-name">${currentUser.name}</span>
                <span class="user-role-tag ${roleClass}">${currentUser.role}</span>
              </div>
              ${userSwitcherOptions}
            </div>

            <button class="btn btn-sm btn-secondary" onclick="window.authManager.logout()" title="Logout of current session">
              🚪 Logout
            </button>
          </div>
        </div>
      </nav>
    `;
  }
}

window.navigationManager = new NavigationManager();
