/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Admin Controller - User Management, Project Archival, and System Controls
 */

class AdminController {
  constructor() {
    this.editingUserId = null;
    this.userCurrentPage = 1;
    this.userPageSize = 10;
  }

  get storage() {
    return window.storageManager;
  }

  get auth() {
    return window.authManager;
  }

  init() {
    this.auth.renderNavbar('admin');
    this.auth.checkPageAccess(['admin']);

    this.renderMetrics();
    this.renderProjectsTable();
    this.renderUsersTable();
    this.bindEvents();
  }

  renderMetrics() {
    const projects = this.storage.getProjects();
    const users = this.storage.getUsers();
    const tasks = this.storage.getTasks();

    const activeProjects = projects.filter(p => p.status === 'Active').length;
    const archivedProjects = projects.filter(p => p.status === 'Archived').length;
    const completedTasks = tasks.filter(t => t.status === 'Done').length;

    const totalPoints = tasks.reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);
    const completedPoints = tasks.filter(t => t.status === 'Done').reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);
    const orgProgress = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    document.getElementById('metric-total-projects').textContent = projects.length;
    document.getElementById('metric-sub-projects').textContent = `${activeProjects} active, ${archivedProjects} archived`;

    document.getElementById('metric-total-users').textContent = users.length;
    document.getElementById('metric-sub-users').textContent = `${this.storage.getDevelopers().length} devs, ${this.storage.getManagers().length} PMs`;

    document.getElementById('metric-total-tasks').textContent = tasks.length;
    document.getElementById('metric-sub-tasks').textContent = `${completedTasks} completed (${orgProgress}% pts)`;

    document.getElementById('metric-total-points').textContent = `${completedPoints} / ${totalPoints} SP`;
    document.getElementById('metric-sub-points').textContent = `Org completion rate: ${orgProgress}%`;
  }

  renderProjectsTable() {
    const container = document.getElementById('projects-table-body');
    if (!container) return;

    const statusFilter = document.getElementById('project-filter-status')?.value || 'all';
    const searchQuery = document.getElementById('project-search')?.value.toLowerCase().trim() || '';

    let projects = this.storage.getProjects();

    if (statusFilter !== 'all') {
      projects = projects.filter(p => p.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (searchQuery) {
      projects = projects.filter(p => p.name.toLowerCase().includes(searchQuery) || p.id.toLowerCase().includes(searchQuery));
    }

    if (projects.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No projects found matching the filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = projects.map(p => {
      const pm = this.storage.getUserById(p.managerId);
      const stats = this.storage.calculateProjectStats(p.id);
      const isArchived = p.status === 'Archived';

      return `
        <tr>
          <td><strong class="task-id">${p.id}</strong></td>
          <td>
            <div style="font-weight: 600; color: var(--slate-900);">${p.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${p.category || 'General'}</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <div class="user-avatar" style="width: 1.5rem; height: 1.5rem; font-size: 0.625rem;">${pm ? pm.avatar : 'PM'}</div>
              <span>${pm ? pm.name : 'Unassigned'}</span>
            </div>
          </td>
          <td>${(p.teamMemberIds || []).length} Devs</td>
          <td style="min-width: 140px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 0.25rem;">
              <span>${stats.completedPoints}/${stats.totalPoints} SP</span>
              <strong>${stats.progressPercent}%</strong>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill success" style="width: ${stats.progressPercent}%;"></div>
            </div>
          </td>
          <td>
            <span class="badge ${isArchived ? 'badge-archived' : 'badge-active'}">${p.status}</span>
          </td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <a href="manager.html?projectId=${p.id}" class="btn btn-sm btn-secondary" title="Open PM Task Backlog">📋 Tasks</a>
              <a href="sprint-planning.html?projectId=${p.id}" class="btn btn-sm btn-secondary" title="Open Sprint Planning">🎯 Sprints</a>
              <a href="create-project.html?id=${p.id}" class="btn btn-sm btn-secondary" title="Edit Project">✏️</a>
              ${isArchived ? `
                <button class="btn btn-sm btn-secondary" title="Restore Project" onclick="window.adminController.restoreProject('${p.id}')">♻️</button>
              ` : `
                <button class="btn btn-sm btn-secondary" title="Archive Project" onclick="window.adminController.archiveProject('${p.id}')">📦</button>
              `}
              <button class="btn btn-sm btn-outline-danger" title="Delete Project" onclick="window.adminController.deleteProject('${p.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderUsersTable() {
    const container = document.getElementById('users-table-body');
    if (!container) return;

    const roleFilter = document.getElementById('user-filter-role')?.value || 'all';
    const searchQuery = document.getElementById('user-search')?.value.toLowerCase().trim() || '';

    let users = this.storage.getUsers();

    if (roleFilter !== 'all') {
      users = users.filter(u => u.role === roleFilter);
    }

    if (searchQuery) {
      users = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery) ||
        u.email.toLowerCase().includes(searchQuery) ||
        (u.skills || []).some(s => s.toLowerCase().includes(searchQuery))
      );
    }

    const totalUsers = users.length;
    const paginationInfo = document.getElementById('user-pagination-info');
    const paginationButtons = document.getElementById('user-pagination-buttons');

    if (totalUsers === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No users found matching criteria.
          </td>
        </tr>
      `;
      if (paginationInfo) paginationInfo.textContent = 'Showing 0-0 of 0 users';
      if (paginationButtons) paginationButtons.innerHTML = '';
      return;
    }

    const isPaged = this.userPageSize !== 'all';
    const pageSize = isPaged ? parseInt(this.userPageSize) : totalUsers;
    const totalPages = isPaged ? Math.ceil(totalUsers / pageSize) : 1;

    if (this.userCurrentPage > totalPages) {
      this.userCurrentPage = 1;
    }

    let displayUsers = users;
    if (isPaged) {
      const startIndex = (this.userCurrentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalUsers);
      displayUsers = users.slice(startIndex, endIndex);

      if (paginationInfo) {
        paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalUsers} users`;
      }
    } else {
      if (paginationInfo) {
        paginationInfo.textContent = `Showing all ${totalUsers} users`;
      }
    }

    if (paginationButtons) {
      if (totalPages > 1) {
        let btnHtml = '';
        btnHtml += `<button type="button" class="btn btn-sm btn-secondary" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;" ${this.userCurrentPage === 1 ? 'disabled' : ''} onclick="window.adminController.handleUserPageChange(${this.userCurrentPage - 1})">Prev</button>`;
        for (let p = 1; p <= totalPages; p++) {
          if (p === 1 || p === totalPages || (p >= this.userCurrentPage - 1 && p <= this.userCurrentPage + 1)) {
            btnHtml += `<button type="button" class="btn btn-sm ${p === this.userCurrentPage ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;" onclick="window.adminController.handleUserPageChange(${p})">${p}</button>`;
          } else if (p === this.userCurrentPage - 2 || p === this.userCurrentPage + 2) {
            btnHtml += `<span style="padding: 0.15rem 0.25rem; color: var(--text-muted); font-size: 0.75rem;">...</span>`;
          }
        }
        btnHtml += `<button type="button" class="btn btn-sm btn-secondary" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;" ${this.userCurrentPage === totalPages ? 'disabled' : ''} onclick="window.adminController.handleUserPageChange(${this.userCurrentPage + 1})">Next</button>`;
        paginationButtons.innerHTML = btnHtml;
      } else {
        paginationButtons.innerHTML = '';
      }
    }

    container.innerHTML = displayUsers.map(u => {
      const roleBadgeClass = u.role === 'admin' ? 'role-admin' : u.role === 'manager' ? 'role-manager' : 'role-developer';
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.625rem;">
              <div class="user-avatar" style="width: 2rem; height: 2rem;">${u.avatar || 'U'}</div>
              <div>
                <strong style="color: var(--slate-900); font-size: 0.875rem;">${u.name}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${u.email}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="user-role-tag ${roleBadgeClass}" style="border: 1px solid currentColor; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm);">
              ${u.role.toUpperCase()}
            </span>
          </td>
          <td>${u.title || '-'}</td>
          <td>
            <div class="skill-tags-list" style="max-width: 260px;">
              ${(u.skills || []).slice(0, 4).map(s => `<span class="skill-tag">${s}</span>`).join('')}
              ${(u.skills || []).length > 4 ? `<span class="skill-tag">+${u.skills.length - 4}</span>` : ''}
            </div>
          </td>
          <td><strong>${u.maxWeeklyHours || 40}h</strong> / week</td>
          <td>${(u.assignedProjects || []).length} Projects</td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-sm btn-secondary" onclick="window.adminController.openEditUserModal('${u.id}')">✏️</button>
              <button class="btn btn-sm btn-outline-danger" onclick="window.adminController.deleteUser('${u.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  handlePageSizeChange(newSize) {
    this.userPageSize = newSize === 'all' ? 'all' : parseInt(newSize);
    this.userCurrentPage = 1;
    this.renderUsersTable();
  }

  handleUserPageChange(pageNum) {
    this.userCurrentPage = pageNum;
    this.renderUsersTable();
  }

  archiveProject(projectId) {
    if (confirm(`Archive project ${projectId}? This will mark it as inactive.`)) {
      this.storage.archiveProject(projectId);
      this.auth.showToast(`Project ${projectId} archived.`, 'info');
      this.renderMetrics();
      this.renderProjectsTable();
    }
  }

  restoreProject(projectId) {
    this.storage.restoreProject(projectId);
    this.auth.showToast(`Project ${projectId} restored to Active.`, 'success');
    this.renderMetrics();
    this.renderProjectsTable();
  }

  deleteProject(projectId) {
    if (confirm(`Permanently delete project ${projectId} and all associated tasks/sprints?`)) {
      this.storage.deleteProject(projectId);
      this.auth.showToast(`Project ${projectId} permanently deleted.`, 'danger');
      this.renderMetrics();
      this.renderProjectsTable();
    }
  }

  openAddUserModal() {
    this.editingUserId = null;
    document.getElementById('user-modal-title').textContent = '➕ Add New User';
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
    document.getElementById('user-modal').classList.add('show');
  }

  openEditUserModal(userId) {
    const user = this.storage.getUserById(userId);
    if (!user) return;

    this.editingUserId = userId;
    document.getElementById('user-modal-title').textContent = `✏️ Edit User: ${user.name}`;
    document.getElementById('user-id').value = user.id;
    document.getElementById('user-name').value = user.name;
    document.getElementById('user-email').value = user.email;
    document.getElementById('user-role').value = user.role;
    document.getElementById('user-title').value = user.title || '';
    document.getElementById('user-exp').value = user.experienceLevel || 'Mid';
    document.getElementById('user-capacity').value = user.maxWeeklyHours || 40;
    document.getElementById('user-skills').value = (user.skills || []).join(', ');

    document.getElementById('user-modal').classList.add('show');
  }

  closeUserModal() {
    document.getElementById('user-modal').classList.remove('show');
  }

  handleSaveUser(e) {
    e.preventDefault();
    const id = document.getElementById('user-id').value || null;
    const name = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const role = document.getElementById('user-role').value;
    const title = document.getElementById('user-title').value.trim();
    const experienceLevel = document.getElementById('user-exp').value;
    const maxWeeklyHours = parseInt(document.getElementById('user-capacity').value) || 40;
    const skills = document.getElementById('user-skills').value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (!name || !email) {
      this.auth.showToast('Please provide both name and email.', 'danger');
      return;
    }

    // Avatar initials
    const avatar = name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() || 'U';

    const existingUser = id ? this.storage.getUserById(id) : null;
    const userData = {
      id: id || undefined,
      name,
      email,
      role,
      avatar,
      title: title || (role === 'admin' ? 'Administrator' : role === 'manager' ? 'Project Manager' : 'Developer'),
      experienceLevel,
      maxWeeklyHours,
      skills,
      assignedProjects: existingUser ? existingUser.assignedProjects : ['PRJ-101']
    };

    const saved = this.storage.saveUser(userData);
    if (saved) {
      this.auth.showToast(`User ${saved.name} saved!`, 'success');
      this.closeUserModal();
      this.renderMetrics();
      this.renderUsersTable();
    }
  }

  deleteUser(userId) {
    const user = this.storage.getUserById(userId);
    if (!user) return;

    if (user.id === this.auth.getCurrentUser()?.id) {
      this.auth.showToast('Cannot delete the currently logged in user profile.', 'warning');
      return;
    }

    if (confirm(`Delete user "${user.name}" (${user.role})? Any assigned tasks will be unassigned.`)) {
      this.storage.deleteUser(userId);
      this.auth.showToast(`User ${user.name} deleted.`, 'info');
      this.renderMetrics();
      this.renderUsersTable();
    }
  }

  handleExportBackup() {
    const json = this.storage.exportDataJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sprintalloc_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.auth.showToast('Backup JSON downloaded successfully!', 'success');
  }

  openImportModal() {
    document.getElementById('import-modal').classList.add('show');
  }

  closeImportModal() {
    document.getElementById('import-modal').classList.remove('show');
  }

  openImportDevModal() {
    const modal = document.getElementById('import-dev-modal');
    if (!modal) return;

    const projSelect = document.getElementById('import-dev-project');
    if (projSelect) {
      const projects = this.storage.getProjects();
      projSelect.innerHTML = `
        <option value="">-- No direct project association (Global) --</option>
        ${projects.map(p => `<option value="${p.id}">${p.id} - ${p.name}</option>`).join('')}
      `;
    }

    const fileInput = document.getElementById('import-dev-file');
    if (fileInput) fileInput.value = '';

    const textarea = document.getElementById('import-dev-textarea');
    if (textarea) textarea.value = '';

    const resultsPanel = document.getElementById('import-dev-results');
    if (resultsPanel) {
      resultsPanel.style.display = 'none';
      resultsPanel.innerHTML = '';
    }

    modal.classList.add('show');
  }

  closeImportDevModal() {
    const modal = document.getElementById('import-dev-modal');
    if (modal) modal.classList.remove('show');
  }

  handleFileSelected(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const textarea = document.getElementById('import-dev-textarea');
      if (textarea) textarea.value = content;
      this.auth.showToast(`Loaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'info');
    };
    reader.readAsText(file);
  }

  processDeveloperImport() {
    const textarea = document.getElementById('import-dev-textarea');
    const content = textarea ? textarea.value.trim() : '';

    if (!content) {
      this.auth.showToast('Please select a file or paste developer dataset records.', 'warning');
      return;
    }

    const projSelect = document.getElementById('import-dev-project');
    const targetProjectId = projSelect ? projSelect.value : null;

    const result = this.storage.importDevelopersDataset(content, targetProjectId);
    const resultsPanel = document.getElementById('import-dev-results');

    if (!resultsPanel) return;

    resultsPanel.style.display = 'block';

    let html = `
      <div style="background-color: var(--slate-100); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.875rem;">
        <h4 style="font-size: 0.875rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--slate-900);">
          📊 Developer Dataset Import &amp; Validation Audit
        </h4>
        <div style="display: flex; gap: 1rem; font-size: 0.8125rem; margin-bottom: 0.75rem;">
          <div>Total Processed: <strong>${result.totalProcessed}</strong></div>
          <div style="color: var(--success);">✅ Successfully Imported: <strong>${result.importedCount}</strong></div>
          <div style="color: ${result.rejectedCount > 0 ? 'var(--danger)' : 'var(--text-muted)'};">
            ${result.rejectedCount > 0 ? '❌' : '✓'} Rejected Records: <strong>${result.rejectedCount}</strong>
          </div>
        </div>
    `;

    if (result.rejectedCount > 0) {
      html += `
        <div style="margin-top: 0.5rem;">
          <strong style="color: var(--danger); font-size: 0.75rem;">Detailed Rejection Log (records not silently discarded):</strong>
          <div style="max-height: 160px; overflow-y: auto; margin-top: 0.35rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); background: white;">
            <table class="table" style="font-size: 0.75rem; margin-bottom: 0;">
              <thead>
                <tr style="background: var(--slate-50);">
                  <th style="padding: 0.35rem 0.5rem;">Row #</th>
                  <th style="padding: 0.35rem 0.5rem;">Record Name</th>
                  <th style="padding: 0.35rem 0.5rem;">Email</th>
                  <th style="padding: 0.35rem 0.5rem;">Validation Rejection Reason(s)</th>
                </tr>
              </thead>
              <tbody>
                ${result.rejectedRecords.map(r => `
                  <tr>
                    <td style="padding: 0.35rem 0.5rem; font-weight: 600;">${r.rowNumber}</td>
                    <td style="padding: 0.35rem 0.5rem;">${r.name}</td>
                    <td style="padding: 0.35rem 0.5rem; font-family: monospace;">${r.email}</td>
                    <td style="padding: 0.35rem 0.5rem; color: var(--danger);">${r.reasons.join('<br>')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    resultsPanel.innerHTML = html;

    if (result.importedCount > 0) {
      this.auth.showToast(`Imported ${result.importedCount} valid developer records!`, 'success');
      this.renderMetrics();
      this.renderUsersTable();
      this.renderProjectsTable();
    } else {
      this.auth.showToast('No records were imported. Please review the validation errors above.', 'warning');
    }
  }

  handleImportData() {
    const text = document.getElementById('import-json-textarea').value.trim();
    if (!text) {
      this.auth.showToast('Please paste a JSON configuration first.', 'warning');
      return;
    }

    const result = this.storage.importDataJSON(text);
    if (result.success) {
      this.auth.showToast('Data imported successfully!', 'success');
      this.closeImportModal();
      setTimeout(() => window.location.reload(), 400);
    } else {
      this.auth.showToast(`Import failed: ${result.error}`, 'danger');
    }
  }

  handleClearAllData() {
    if (confirm('Permanently clear all user-entered projects, tasks, sprints, and user accounts from LocalStorage?')) {
      this.storage.clearAllData();
      this.auth.showToast('All stored records cleared.', 'info');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    }
  }

  bindEvents() {
    // Project filters
    document.getElementById('project-filter-status')?.addEventListener('change', () => this.renderProjectsTable());
    document.getElementById('project-search')?.addEventListener('input', () => this.renderProjectsTable());

    // User filters
    document.getElementById('user-filter-role')?.addEventListener('change', () => this.renderUsersTable());
    document.getElementById('user-search')?.addEventListener('input', () => this.renderUsersTable());

    // User form
    document.getElementById('user-form')?.addEventListener('submit', (e) => this.handleSaveUser(e));
  }
}

window.adminController = new AdminController();
