/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Projects Controller - CRUD, Validation, and View Logic
 */

class ProjectsController {
  constructor() {}

  get storage() {
    return window.storageManager;
  }

  get auth() {
    return window.authManager;
  }

  initCreateOrEditPage() {
    this.auth.renderNavbar('create-project');
    this.auth.checkPageAccess(['admin', 'manager']);

    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    this.populateManagersDropdown();
    this.populateTeamMembersList();

    if (projectId) {
      this.loadProjectForEdit(projectId);
    } else {
      // Auto-suggest next Project ID
      const projects = this.storage.getProjects();
      const nextId = `PRJ-${100 + projects.length + 1}`;
      const idInput = document.getElementById('project-id');
      if (idInput) idInput.value = nextId;

      // Default start date today, target end date in 60 days
      const today = new Date().toISOString().split('T')[0];
      const targetDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const startInput = document.getElementById('project-start-date');
      const endInput = document.getElementById('project-end-date');
      if (startInput) startInput.value = today;
      if (endInput) endInput.value = targetDate;

      this.updateLivePreview();
    }

    this.bindFormEvents();
  }

  populateManagersDropdown(selectedId = null) {
    const select = document.getElementById('project-manager');
    if (!select) return;
    const managers = this.storage.getManagers();
    if (managers.length === 0) {
      select.innerHTML = '<option value="">No Project Managers registered yet</option>';
      return;
    }
    select.innerHTML = `
      <option value="">Select Project Manager</option>
      ${managers.map(m => `
        <option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>
          ${m.name} (${m.title || 'PM'})
        </option>
      `).join('')}
    `;
  }

  populateTeamMembersList(selectedMemberIds = []) {
    const container = document.getElementById('team-members-container');
    if (!container) return;
    const developers = this.storage.getDevelopers();

    if (developers.length === 0) {
      container.innerHTML = `
        <div style="padding: 1rem; color: var(--text-muted); font-size: 0.8125rem;">
          No developer accounts registered in system yet. The Administrator can add developers in the Admin Dashboard.
        </div>
      `;
      return;
    }

    container.innerHTML = developers.map(dev => {
      const isChecked = selectedMemberIds.includes(dev.id);
      return `
        <label class="card" style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; cursor: pointer; margin-bottom: 0.5rem;">
          <input type="checkbox" name="teamMembers" value="${dev.id}" ${isChecked ? 'checked' : ''} style="margin-top: 0.25rem;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <strong style="font-size: 0.875rem;">${dev.name}</strong>
              <span class="badge ${dev.experienceLevel === 'Senior' ? 'badge-priority-high' : 'badge-priority-medium'}">${dev.experienceLevel} (${dev.maxWeeklyHours}h/wk)</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.35rem;">${dev.title}</div>
            <div class="skill-tags-list">
              ${(dev.skills || []).map(s => `<span class="skill-tag">${s}</span>`).join('')}
            </div>
          </div>
        </label>
      `;
    }).join('');
  }

  loadProjectForEdit(projectId) {
    const project = this.storage.getProjectById(projectId);
    if (!project) {
      this.auth.showToast(`Project ${projectId} not found.`, 'danger');
      return;
    }

    document.getElementById('page-heading').textContent = `Edit Project: ${project.id}`;
    document.getElementById('page-subheading').textContent = `Update details, assigned team, and timeline for ${project.name}`;
    document.getElementById('submit-btn').textContent = '💾 Update Project';

    const idInput = document.getElementById('project-id');
    if (idInput) {
      idInput.value = project.id;
      idInput.disabled = true; // Cannot alter ID of existing project
    }

    document.getElementById('project-name').value = project.name || '';
    document.getElementById('project-category').value = project.category || 'Web Application';
    document.getElementById('project-description').value = project.description || '';
    document.getElementById('project-priority').value = project.priority || 'Medium';
    document.getElementById('project-status').value = project.status || 'Active';
    document.getElementById('project-start-date').value = project.startDate || '';
    document.getElementById('project-end-date').value = project.targetEndDate || '';

    this.populateManagersDropdown(project.managerId);
    this.populateTeamMembersList(project.teamMemberIds || []);
    this.updateLivePreview();
  }

  bindFormEvents() {
    const form = document.getElementById('project-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit();
      });
    }

    // Input listeners for live preview
    ['project-name', 'project-category', 'project-priority', 'project-status', 'project-description', 'project-start-date', 'project-end-date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.updateLivePreview());
      if (el) el.addEventListener('change', () => this.updateLivePreview());
    });

    // Checkbox listener
    const container = document.getElementById('team-members-container');
    if (container) {
      container.addEventListener('change', () => this.updateLivePreview());
    }
  }

  updateLivePreview() {
    const previewName = document.getElementById('preview-name');
    const previewCategory = document.getElementById('preview-category');
    const previewPriority = document.getElementById('preview-priority');
    const previewStatus = document.getElementById('preview-status');
    const previewDesc = document.getElementById('preview-desc');
    const previewDates = document.getElementById('preview-dates');
    const previewTeamCount = document.getElementById('preview-team-count');

    const name = document.getElementById('project-name')?.value || 'New Project Title';
    const category = document.getElementById('project-category')?.value || 'Category';
    const priority = document.getElementById('project-priority')?.value || 'Medium';
    const status = document.getElementById('project-status')?.value || 'Active';
    const desc = document.getElementById('project-description')?.value || 'Project description will appear here as you type...';
    const startDate = document.getElementById('project-start-date')?.value || 'TBD';
    const endDate = document.getElementById('project-end-date')?.value || 'TBD';

    const selectedMembers = Array.from(document.querySelectorAll('input[name="teamMembers"]:checked'));

    if (previewName) previewName.textContent = name;
    if (previewCategory) previewCategory.textContent = category;
    if (previewPriority) {
      previewPriority.textContent = priority;
      previewPriority.className = `badge badge-priority-${priority.toLowerCase()}`;
    }
    if (previewStatus) {
      previewStatus.textContent = status;
      previewStatus.className = `badge ${status === 'Active' ? 'badge-active' : 'badge-todo'}`;
    }
    if (previewDesc) previewDesc.textContent = desc;
    if (previewDates) previewDates.textContent = `${startDate} → ${endDate}`;
    if (previewTeamCount) previewTeamCount.textContent = `${selectedMembers.length} Developer(s) Assigned`;
  }

  handleSubmit() {
    const id = document.getElementById('project-id').value.trim();
    const name = document.getElementById('project-name').value.trim();
    const category = document.getElementById('project-category').value;
    const description = document.getElementById('project-description').value.trim();
    const managerId = document.getElementById('project-manager').value;
    const priority = document.getElementById('project-priority').value;
    const status = document.getElementById('project-status').value;
    const startDate = document.getElementById('project-start-date').value;
    const targetEndDate = document.getElementById('project-end-date').value;

    const selectedMembers = Array.from(document.querySelectorAll('input[name="teamMembers"]:checked'))
      .map(cb => cb.value);

    // Validation
    if (!id) {
      this.auth.showToast('Please specify a Project ID.', 'danger');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const editingId = urlParams.get('id');
    if (!editingId && this.storage.getProjectById(id)) {
      this.auth.showToast(`A project with ID "${id}" already exists. Please choose a unique Project ID.`, 'danger');
      return;
    }

    if (!name) {
      this.auth.showToast('Please enter a project name.', 'danger');
      return;
    }

    if (startDate && targetEndDate && new Date(targetEndDate) <= new Date(startDate)) {
      this.auth.showToast('Target End Date must be after Start Date.', 'danger');
      return;
    }

    if (selectedMembers.length === 0) {
      if (!confirm('No developers were assigned to this project. Continue anyway?')) {
        return;
      }
    }

    const projectData = {
      id,
      name,
      category,
      description,
      managerId,
      teamMemberIds: selectedMembers,
      priority,
      status,
      startDate,
      targetEndDate
    };

    const saved = this.storage.saveProject(projectData);
    if (saved) {
      this.auth.showToast(`Project "${saved.name}" successfully saved!`, 'success');
      // Set active project to this one
      this.storage.setActiveProject(saved.id);
      setTimeout(() => {
        const user = this.auth.getCurrentUser();
        if (user && user.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'manager.html';
        }
      }, 500);
    } else {
      this.auth.showToast('Failed to save project.', 'danger');
    }
  }
}

window.projectsController = new ProjectsController();
