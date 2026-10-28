/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Project Manager Controller - Project Health, Deadline Risk, and Resource Capacity
 */

class ManagerController {
  constructor() {
    this.storage = window.storageManager;
    this.auth = window.authManager;
    this.currentProjectId = null;
  }

  init() {
    this.auth.renderNavbar('manager');
    this.auth.checkPageAccess(['admin', 'manager']);

    const urlParams = new URLSearchParams(window.location.search);
    this.currentProjectId = urlParams.get('projectId') || this.storage.getActiveProjectId();

    this.initProjectSwitcher();
    this.render();
    this.bindEvents();
  }

  initProjectSwitcher() {
    const select = document.getElementById('pm-project-select');
    if (!select) return;

    const allProjects = this.storage.getProjects();
    if (allProjects.length === 0) {
      select.innerHTML = `<option value="">No projects created yet</option>`;
      return;
    }

    select.innerHTML = allProjects.map(p => `
      <option value="${p.id}" ${p.id === this.currentProjectId ? 'selected' : ''}>
        ${p.id} - ${p.name} (${p.status})
      </option>
    `).join('');

    select.addEventListener('change', () => {
      this.currentProjectId = select.value;
      this.storage.setActiveProject(select.value);
      this.render();
    });
  }

  handleManualProjectLookup() {
    const input = document.getElementById('manual-project-id-input');
    if (!input) return;
    const val = input.value.trim().toUpperCase();
    if (!val) return;

    const project = this.storage.getProjectById(val);
    if (project) {
      this.currentProjectId = project.id;
      this.storage.setActiveProject(project.id);
      this.initProjectSwitcher();
      this.render();
      this.auth.showToast(`Switched to Project ${project.id}: ${project.name}`, 'success');
      input.value = '';
    } else {
      this.auth.showToast(`Project ID "${val}" was not found in records.`, 'danger');
    }
  }

  render() {
    const project = this.storage.getProjectById(this.currentProjectId);
    if (!project) {
      this.renderNoProject();
      return;
    }

    this.renderProjectHeader(project);
    this.renderMetrics(project);
    this.renderRiskAlerts(project);
    this.renderSprintsList(project);
    this.renderTeamAllocation(project);
    this.renderTasksTable(project);
  }

  renderNoProject() {
    const container = document.getElementById('pm-main-content');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No Project Selected</div>
          <div class="empty-state-text">Please choose an active project or create a new one to manage.</div>
          <a href="create-project.html" class="btn btn-primary">+ Create New Project</a>
        </div>
      `;
    }
  }

  renderProjectHeader(project) {
    const pm = this.storage.getUserById(project.managerId);
    const stats = this.storage.calculateProjectStats(project.id);

    document.getElementById('pm-project-name').textContent = project.name;
    document.getElementById('pm-project-desc').textContent = project.description || '';
    document.getElementById('pm-project-id-badge').textContent = project.id;
    document.getElementById('pm-project-category').textContent = project.category || 'General';
    document.getElementById('pm-project-dates').textContent = `📅 ${project.startDate} → Target: ${project.targetEndDate}`;
    document.getElementById('pm-project-manager-name').textContent = pm ? pm.name : 'Unassigned';

    // Overall Progress Bar
    document.getElementById('pm-project-progress-text').textContent = `${stats.progressPercent}% (${stats.completedPoints}/${stats.totalPoints} SP completed)`;
    const fill = document.getElementById('pm-project-progress-fill');
    if (fill) {
      fill.style.width = `${stats.progressPercent}%`;
    }

    // Direct link buttons
    const planBtn = document.getElementById('btn-goto-sprint-plan');
    if (planBtn) planBtn.href = `sprint-planning.html?projectId=${project.id}`;

    const newTaskBtn = document.getElementById('btn-goto-new-task');
    if (newTaskBtn) newTaskBtn.href = `create-task.html?projectId=${project.id}`;

    const analyticsBtn = document.getElementById('btn-goto-analytics');
    if (analyticsBtn) analyticsBtn.href = `analytics.html?projectId=${project.id}`;
  }

  renderMetrics(project) {
    const stats = this.storage.calculateProjectStats(project.id);
    const activeSprint = this.storage.getActiveSprint(project.id);
    const sprintStats = activeSprint ? this.storage.calculateSprintStats(activeSprint.id) : null;

    // Active Sprint commitment
    document.getElementById('pm-metric-sprint-pts').textContent = sprintStats ? `${sprintStats.totalPoints} / ${sprintStats.capacityPoints} SP` : '0 SP';
    document.getElementById('pm-metric-sub-sprint').textContent = activeSprint ? activeSprint.name : 'No active sprint';

    // Overdue count
    const overdueEl = document.getElementById('pm-metric-overdue');
    overdueEl.textContent = stats.overdueCount;
    document.getElementById('pm-card-overdue').className = `metric-card ${stats.overdueCount > 0 ? 'danger' : 'success'}`;

    // High risk count
    const highRiskEl = document.getElementById('pm-metric-highrisk');
    highRiskEl.textContent = stats.highRiskCount;
    document.getElementById('pm-card-highrisk').className = `metric-card ${stats.highRiskCount > 0 ? 'warning' : 'primary'}`;

    // Team Capacity
    const devs = this.storage.getDevelopers();
    let totalCap = 0;
    let totalLoad = 0;
    devs.forEach(d => {
      const load = this.storage.calculateDeveloperWorkload(d.id, activeSprint?.id);
      totalCap += load.maxCapacity;
      totalLoad += load.assignedHours;
    });
    const utilPercent = totalCap > 0 ? Math.round((totalLoad / totalCap) * 100) : 0;
    document.getElementById('pm-metric-utilization').textContent = `${utilPercent}%`;
    document.getElementById('pm-metric-sub-utilization').textContent = `${Math.round(totalLoad)}h assigned / ${totalCap}h cap`;
  }

  renderRiskAlerts(project) {
    const container = document.getElementById('risk-alerts-container');
    if (!container) return;

    const tasks = this.storage.getTasksByProject(project.id);
    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info" style="margin-bottom: 0;">
          <span>ℹ️ <strong>No Tasks Recorded:</strong> No tasks have been created for this project yet. Use the "+ New Task" button above to add tasks.</span>
        </div>
      `;
      return;
    }

    const flaggedTasks = [];

    tasks.forEach(t => {
      const risk = this.storage.calculateTaskRisk(t);
      if (risk.riskLevel === 'OVERDUE' || risk.riskLevel === 'HIGH') {
        flaggedTasks.push({ task: t, risk });
      }
    });

    if (flaggedTasks.length === 0) {
      container.innerHTML = `
        <div class="alert alert-success" style="margin-bottom: 0;">
          <span>✅ <strong>Project Health Optimal:</strong> No tasks are currently overdue or at critical deadline risk. Sprint velocity is on track!</span>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 0.75rem; font-size: 0.875rem; font-weight: 600; color: var(--danger);">
        ⚠️ Attention Required: ${flaggedTasks.length} task(s) require intervention due to deadline risk:
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${flaggedTasks.map(({ task, risk }) => {
          const assignee = task.assigneeId ? this.storage.getUserById(task.assigneeId) : null;
          return `
            <div style="background-color: #fff; border: 1px solid ${risk.riskLevel === 'OVERDUE' ? '#fca5a5' : '#fde68a'}; border-left: 4px solid ${risk.riskLevel === 'OVERDUE' ? 'var(--danger)' : 'var(--warning)'}; border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <strong class="task-id">${task.id}</strong>
                  <span class="badge ${risk.badgeClass}">${risk.label}</span>
                  <a href="task-details.html?id=${task.id}" style="font-weight: 600; color: var(--slate-900); text-decoration: none;">${task.title}</a>
                </div>
                <div style="font-size: 0.75rem; color: var(--slate-600); margin-top: 0.25rem;">
                  ${risk.reason} | Assignee: <strong>${assignee ? assignee.name : 'Unassigned'}</strong> | Deadline: <strong>${task.deadline}</strong>
                </div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <a href="create-task.html?id=${task.id}" class="btn btn-sm btn-secondary">Reassign</a>
                <a href="task-details.html?id=${task.id}" class="btn btn-sm btn-primary">Inspect Details</a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderSprintsList(project) {
    const container = document.getElementById('sprints-list-container');
    if (!container) return;

    const sprints = this.storage.getSprintsByProject(project.id);
    if (sprints.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.875rem;">
          No sprints scheduled for this project. Click "+ Plan" above to create a sprint.
        </div>
      `;
      return;
    }

    container.innerHTML = sprints.map(s => {
      const stats = this.storage.calculateSprintStats(s.id);
      return `
        <div class="card" style="margin-bottom: 0.75rem; padding: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <div>
              <strong style="font-size: 0.9375rem; color: var(--slate-900);">${s.name}</strong>
              <span class="badge ${s.status === 'Active' ? 'badge-active' : s.status === 'Completed' ? 'badge-done' : 'badge-todo'}" style="margin-left: 0.5rem;">
                ${s.status}
              </span>
            </div>
            <a href="sprint-planning.html?projectId=${project.id}&sprintId=${s.id}" class="btn btn-sm btn-primary">
              🎯 Plan Sprint
            </a>
          </div>
          <div style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.5rem;">
            ${s.goal || 'No goal set'} (📅 ${s.startDate} to ${s.endDate})
          </div>
          <div style="display: flex; gap: 1.5rem; font-size: 0.8125rem; color: var(--slate-700);">
            <span>Committed: <strong>${stats.totalPoints} / ${stats.capacityPoints} SP</strong></span>
            <span>Effort: <strong>${stats.loggedHours}h / ${stats.totalHours}h</strong></span>
            <span>Tasks: <strong>${stats.taskCount}</strong></span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderTeamAllocation(project) {
    const container = document.getElementById('team-allocation-container');
    if (!container) return;

    const activeSprint = this.storage.getActiveSprint(project.id);
    const developers = this.storage.getDevelopers();

    if (developers.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.875rem;">
          No developer accounts registered in system. The Administrator can add developers from the Admin Dashboard.
        </div>
      `;
      return;
    }

    container.innerHTML = developers.map(dev => {
      const load = this.storage.calculateDeveloperWorkload(dev.id, activeSprint?.id);
      const isOver = load.isOverloaded;
      const meterClass = isOver ? 'overload' : load.utilizationPercent >= 80 ? 'moderate' : 'normal';

      return `
        <div class="workload-item ${isOver ? 'is-overloaded' : ''}">
          <div class="workload-header">
            <div class="workload-dev">
              <div class="user-avatar" style="width: 1.75rem; height: 1.75rem; font-size: 0.6875rem;">${dev.avatar}</div>
              <div>
                <strong style="font-size: 0.875rem;">${dev.name}</strong>
                <span style="font-size: 0.75rem; color: var(--text-muted);"> (${dev.title})</span>
              </div>
            </div>
            <div style="font-size: 0.8125rem; font-weight: 700; color: ${isOver ? 'var(--danger)' : 'var(--slate-800)'};">
              ${load.assignedHours}h / ${load.maxCapacity}h (${load.utilizationPercent}%)
            </div>
          </div>
          <div class="workload-meter">
            <div class="workload-fill ${meterClass}" style="width: ${Math.min(100, load.utilizationPercent)}%;"></div>
          </div>
          ${isOver ? `
            <div class="workload-alert-badge">
              ⚠️ Capacity Exceeded by ${load.excessHours} hours!
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  renderTasksTable(project) {
    const tbody = document.getElementById('pm-tasks-table-body');
    if (!tbody) return;

    const statusFilter = document.getElementById('pm-task-filter-status')?.value || 'all';
    const searchQuery = document.getElementById('pm-task-search')?.value.toLowerCase().trim() || '';

    let tasks = this.storage.getTasksByProject(project.id);

    if (statusFilter !== 'all') {
      tasks = tasks.filter(t => t.status === statusFilter);
    }

    if (searchQuery) {
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(searchQuery) ||
        t.id.toLowerCase().includes(searchQuery) ||
        (t.requiredSkills || []).some(s => s.toLowerCase().includes(searchQuery))
      );
    }

    if (tasks.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No tasks match the active filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = tasks.map(task => {
      const assignee = task.assigneeId ? this.storage.getUserById(task.assigneeId) : null;
      const sprint = task.sprintId ? this.storage.getSprintById(task.sprintId) : null;
      const risk = this.storage.calculateTaskRisk(task);

      return `
        <tr>
          <td><strong class="task-id">${task.id}</strong></td>
          <td>
            <a href="task-details.html?id=${task.id}" style="font-weight: 600; color: var(--slate-900); text-decoration: none;">
              ${task.title}
            </a>
            <div style="margin-top: 0.25rem;">
              <div class="skill-tags-list">
                ${(task.requiredSkills || []).map(s => `<span class="skill-tag">${s}</span>`).join('')}
              </div>
            </div>
          </td>
          <td>
            <select class="form-control" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto;" onchange="window.managerController.quickUpdateStatus('${task.id}', this.value)">
              <option value="To Do" ${task.status === 'To Do' ? 'selected' : ''}>To Do</option>
              <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Code Review" ${task.status === 'Code Review' ? 'selected' : ''}>Code Review</option>
              <option value="Done" ${task.status === 'Done' ? 'selected' : ''}>Done</option>
            </select>
          </td>
          <td>
            <span class="badge badge-priority-${task.priority.toLowerCase()}">${task.priority}</span>
          </td>
          <td>
            <span class="badge ${risk.badgeClass}" title="${risk.reason}">${risk.label}</span>
            <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.15rem;">${task.deadline || 'No date'}</div>
          </td>
          <td>
            ${assignee ? `
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <div class="user-avatar" style="width: 1.5rem; height: 1.5rem; font-size: 0.625rem;">${assignee.avatar}</div>
                <span style="font-size: 0.8125rem;">${assignee.name}</span>
              </div>
            ` : '<span style="font-size: 0.8125rem; color: var(--text-muted);">Unassigned</span>'}
          </td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <a href="task-details.html?id=${task.id}" class="btn btn-sm btn-secondary" title="View Details">🔍</a>
              <a href="create-task.html?id=${task.id}" class="btn btn-sm btn-secondary" title="Edit Task">✏️</a>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  quickUpdateStatus(taskId, newStatus) {
    const task = this.storage.getTaskById(taskId);
    if (!task) return;

    task.status = newStatus;
    this.storage.saveTask(task);
    this.auth.showToast(`Updated ${task.id} to ${newStatus}`, 'success');
    this.render();
  }

  bindEvents() {
    document.getElementById('pm-task-filter-status')?.addEventListener('change', () => this.renderTasksTable(this.storage.getProjectById(this.currentProjectId)));
    document.getElementById('pm-task-search')?.addEventListener('input', () => this.renderTasksTable(this.storage.getProjectById(this.currentProjectId)));

    // Manual lookup form
    const lookupForm = document.getElementById('manual-project-lookup-form');
    if (lookupForm) {
      lookupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleManualProjectLookup();
      });
    }
  }
}

window.managerController = new ManagerController();
