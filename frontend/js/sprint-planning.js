/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Sprint Planning Controller - Backlog Allocation, Capacity Balancing, and Warnings
 */

class SprintPlanningController {
  constructor() {
    this.activeSprintId = null;
    this.activeProjectId = null;
  }

  get storage() {
    return window.storageManager;
  }

  get auth() {
    return window.authManager;
  }

  init() {
    this.auth.renderNavbar('sprint-planning');
    this.auth.checkPageAccess(['admin', 'manager', 'developer']);

    const urlParams = new URLSearchParams(window.location.search);
    this.activeProjectId = urlParams.get('projectId') || this.storage.getActiveProjectId();
    this.activeSprintId = urlParams.get('sprintId');

    this.populateSprintDropdown();
    this.bindEvents();
    this.render();
  }

  populateSprintDropdown() {
    const select = document.getElementById('sprint-select');
    if (!select) return;

    const sprints = this.storage.getSprintsByProject(this.activeProjectId);
    if (sprints.length === 0) {
      select.innerHTML = `<option value="">No sprints created yet</option>`;
      return;
    }

    // Default to active sprint if not set
    if (!this.activeSprintId) {
      const active = sprints.find(s => s.status === 'Active') || sprints[0];
      this.activeSprintId = active ? active.id : null;
    }

    select.innerHTML = sprints.map(s => `
      <option value="${s.id}" ${s.id === this.activeSprintId ? 'selected' : ''}>
        ${s.name} (${s.status.toUpperCase()})
      </option>
    `).join('');

    select.addEventListener('change', () => {
      this.activeSprintId = select.value;
      this.render();
    });
  }

  render() {
    const project = this.storage.getProjectById(this.activeProjectId);
    const sprint = this.storage.getSprintById(this.activeSprintId);

    // Update Project and Sprint Titles
    const projectTitleEl = document.getElementById('sprint-project-title');
    if (projectTitleEl && project) {
      projectTitleEl.textContent = `${project.id} - ${project.name}`;
    }

    if (!sprint) {
      this.renderNoSprintState();
      return;
    }

    this.renderSprintBanner(sprint);
    this.renderBacklogColumn();
    this.renderSprintColumn(sprint);
    this.renderTeamWorkloadSummary(sprint);
    this.renderUnassignedDevelopers(sprint);
  }

  renderNoSprintState() {
    const container = document.getElementById('sprint-board-wrapper');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎯</div>
          <div class="empty-state-title">No Sprints Found for this Project</div>
          <div class="empty-state-text">Create your first sprint to begin allocating backlog tasks and balancing developer capacity.</div>
          <button class="btn btn-primary" onclick="window.sprintPlanningController.openCreateSprintModal()">➕ Create Sprint</button>
        </div>
      `;
    }
  }

  renderSprintBanner(sprint) {
    const stats = this.storage.calculateSprintStats(sprint.id);

    document.getElementById('sprint-name-display').textContent = sprint.name;
    document.getElementById('sprint-goal-display').textContent = sprint.goal || 'No sprint goal specified.';
    document.getElementById('sprint-dates-display').textContent = `📅 ${sprint.startDate} to ${sprint.endDate}`;

    const statusBadge = document.getElementById('sprint-status-badge');
    if (statusBadge) {
      statusBadge.textContent = sprint.status;
      statusBadge.className = `badge ${sprint.status === 'Active' ? 'badge-active' : sprint.status === 'Completed' ? 'badge-done' : 'badge-todo'}`;
    }

    // Capacity numbers
    document.getElementById('sprint-pts-ratio').textContent = `${stats.totalPoints} / ${stats.capacityPoints} SP (${stats.pointCapacityPercent}%)`;
    document.getElementById('sprint-hrs-ratio').textContent = `${stats.totalHours} / ${stats.capacityHours} Hours (${stats.hourCapacityPercent}%)`;

    const ptsFill = document.getElementById('sprint-pts-fill');
    if (ptsFill) {
      ptsFill.style.width = `${Math.min(100, stats.pointCapacityPercent)}%`;
      ptsFill.className = `progress-bar-fill ${stats.pointCapacityPercent > 100 ? 'danger' : stats.pointCapacityPercent >= 80 ? 'warning' : 'success'}`;
    }

    const hrsFill = document.getElementById('sprint-hrs-fill');
    if (hrsFill) {
      hrsFill.style.width = `${Math.min(100, stats.hourCapacityPercent)}%`;
      hrsFill.className = `progress-bar-fill ${stats.hourCapacityPercent > 100 ? 'danger' : stats.hourCapacityPercent >= 80 ? 'warning' : 'success'}`;
    }

    // Capacity warning alert
    const bannerAlert = document.getElementById('sprint-capacity-alert');
    if (bannerAlert) {
      if (stats.isCapacityExceeded) {
        bannerAlert.style.display = 'flex';
        bannerAlert.innerHTML = `
          <span>⚠️ <strong>Sprint Capacity Overload:</strong> Committed work exceeds planned sprint limits (${stats.totalPoints > stats.capacityPoints ? `${stats.totalPoints - stats.capacityPoints} points over` : `${stats.totalHours - stats.capacityHours}h over`}). Consider de-scoping tasks to avoid sprint rollover.</span>
        `;
      } else {
        bannerAlert.style.display = 'none';
      }
    }

    // Status action button
    const actionBtn = document.getElementById('sprint-action-btn');
    if (actionBtn) {
      if (sprint.status === 'Planned') {
        actionBtn.innerHTML = '🚀 Start Sprint';
        actionBtn.className = 'btn btn-sm btn-success';
        actionBtn.onclick = () => this.updateSprintStatus(sprint.id, 'Active');
      } else if (sprint.status === 'Active') {
        actionBtn.innerHTML = '🏁 Complete Sprint';
        actionBtn.className = 'btn btn-sm btn-primary';
        actionBtn.onclick = () => this.updateSprintStatus(sprint.id, 'Completed');
      } else {
        actionBtn.innerHTML = '🔄 Reopen Sprint';
        actionBtn.className = 'btn btn-sm btn-secondary';
        actionBtn.onclick = () => this.updateSprintStatus(sprint.id, 'Active');
      }
    }
  }

  renderBacklogColumn() {
    const container = document.getElementById('backlog-tasks-container');
    const countEl = document.getElementById('backlog-count');
    if (!container) return;

    // Get tasks for this project without sprint
    const allBacklog = this.storage.getTasksByProject(this.activeProjectId).filter(t => !t.sprintId);
    if (countEl) countEl.textContent = allBacklog.length;

    if (allBacklog.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.875rem;">
          <div>📦 Backlog is empty!</div>
          <div style="margin-top: 0.5rem;">
            <a href="create-task.html?projectId=${this.activeProjectId}" class="btn btn-sm btn-secondary">+ Create New Task</a>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = allBacklog.map(task => {
      return `
        <div class="task-card">
          <div class="task-card-header">
            <span class="task-id">${task.id}</span>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              <span class="badge badge-priority-${task.priority.toLowerCase()}">${task.priority}</span>
              <span class="task-points-badge">${task.storyPoints} SP</span>
            </div>
          </div>

          <div class="task-title">
            <a href="task-details.html?id=${task.id}" style="color: inherit; text-decoration: none;">${task.title}</a>
          </div>

          <div style="margin-bottom: 0.5rem;">
            <div class="skill-tags-list">
              ${(task.requiredSkills || []).map(s => `<span class="skill-tag">${s}</span>`).join('')}
            </div>
          </div>

          <div class="task-card-meta">
            <span>⏱️ Est: ${task.estimatedHours}h</span>
            <button class="btn btn-sm btn-primary" onclick="window.sprintPlanningController.moveTaskToSprint('${task.id}')">
              Move to Sprint ➡️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderSprintColumn(sprint) {
    const container = document.getElementById('sprint-tasks-container');
    const countEl = document.getElementById('sprint-task-count');
    if (!container) return;

    const sprintTasks = this.storage.getTasksBySprint(sprint.id);
    if (countEl) countEl.textContent = sprintTasks.length;

    if (sprintTasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.875rem;">
          <div>🎯 No tasks in this sprint yet.</div>
          <p style="font-size: 0.8125rem; margin-top: 0.35rem;">Click "Move to Sprint ➡️" on any backlog task to commit it to this sprint.</p>
        </div>
      `;
      return;
    }

    const developers = this.storage.getDevelopers();

    container.innerHTML = sprintTasks.map(task => {
      const risk = this.storage.calculateTaskRisk(task);
      const assignee = task.assigneeId ? this.storage.getUserById(task.assigneeId) : null;

      // Calculate recommendations for this task
      const recResult = this.storage.recommendDevelopersForTask(task, sprint.id);
      const recommendations = (recResult && recResult.recommendations) ? recResult.recommendations : [];

      return `
        <div class="task-card">
          <div class="task-card-header">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <span class="task-id">${task.id}</span>
              <span class="badge ${risk.badgeClass}">${risk.label}</span>
            </div>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              <span class="badge badge-priority-${task.priority.toLowerCase()}">${task.priority}</span>
              <span class="task-points-badge">${task.storyPoints} SP</span>
            </div>
          </div>

          <div class="task-title">
            <a href="task-details.html?id=${task.id}" style="color: inherit; text-decoration: none;">${task.title}</a>
          </div>

          <!-- Assignment & Intelligent Recommendation Row -->
          <div style="background-color: var(--slate-50); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.5rem; margin: 0.5rem 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span style="font-size: 0.75rem; font-weight: 600; color: var(--slate-700);">Assignee & Skill Match:</span>
              <button type="button" class="btn btn-sm btn-secondary" style="padding: 0.1rem 0.4rem; font-size: 0.6875rem;" onclick="window.sprintPlanningController.showRecommendationModal('${task.id}')">
                🤖 Explain Best Fit
              </button>
            </div>

            <select class="form-control" style="font-size: 0.8125rem; padding: 0.35rem 0.5rem;" onchange="window.sprintPlanningController.assignDeveloperToTask('${task.id}', this.value)">
              <option value="">👤 Unassigned</option>
              ${recommendations.map(rec => {
                const dev = rec.developer;
                const isSelected = task.assigneeId === dev.id;
                const overloadTag = rec.breakdown.willExceedCapacity ? '⚠️ [OVERLOAD]' : '';
                return `
                  <option value="${dev.id}" ${isSelected ? 'selected' : ''}>
                    ${dev.name} (${rec.totalScore}% match) ${overloadTag}
                  </option>
                `;
              }).join('')}
            </select>
          </div>

          <div class="task-card-meta">
            <span>⏱️ ${task.actualHours || 0}h / ${task.estimatedHours}h</span>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-sm btn-secondary" onclick="window.sprintPlanningController.moveTaskToBacklog('${task.id}')">
                ⬅️ Backlog
              </button>
              <a href="task-details.html?id=${task.id}" class="btn btn-sm btn-primary">
                Details
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderTeamWorkloadSummary(sprint) {
    const container = document.getElementById('team-workload-container');
    if (!container) return;

    const developers = this.storage.getDevelopers();
    if (developers.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem 1rem; color: var(--text-muted); font-size: 0.8125rem;">
          👥 No registered developers found. Register developers in the Admin Dashboard to track workload.
        </div>
      `;
      return;
    }
    container.innerHTML = developers.map(dev => {
      const load = this.storage.calculateDeveloperWorkload(dev.id, sprint.id);
      const isOver = load.isOverloaded;
      const meterClass = isOver ? 'overload' : load.utilizationPercent >= 80 ? 'moderate' : 'normal';

      return `
        <div class="workload-item ${isOver ? 'is-overloaded' : ''}">
          <div class="workload-header">
            <div class="workload-dev">
              <div class="user-avatar" style="width: 1.875rem; height: 1.875rem; font-size: 0.6875rem;">${dev.avatar}</div>
              <div>
                <div class="workload-name">${dev.name}</div>
                <div class="workload-title">${dev.title}</div>
              </div>
            </div>
            <div class="workload-stats" style="color: ${isOver ? 'var(--danger)' : 'var(--slate-800)'};">
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

  moveTaskToSprint(taskId) {
    if (!this.activeSprintId) {
      this.auth.showToast('Please select or create an active sprint first.', 'warning');
      return;
    }
    const task = this.storage.getTaskById(taskId);
    if (!task) return;

    task.sprintId = this.activeSprintId;
    this.storage.saveTask(task);
    this.auth.showToast(`Committed "${task.title}" to sprint.`, 'success');
    this.render();
  }

  moveTaskToBacklog(taskId) {
    const task = this.storage.getTaskById(taskId);
    if (!task) return;

    task.sprintId = null;
    this.storage.saveTask(task);
    this.auth.showToast(`Returned "${task.title}" to product backlog.`, 'info');
    this.render();
  }

  renderUnassignedDevelopers(sprint) {
    const container = document.getElementById('unassigned-developers-container');
    if (!container) return;

    const unassignedList = this.storage.getUnassignedDevelopersExplanation(this.activeProjectId, sprint.id);

    if (unassignedList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 1rem; color: var(--text-muted); font-size: 0.8125rem;">
          ✓ All eligible developers have assigned tasks in this sprint.
        </div>
      `;
      return;
    }

    container.innerHTML = unassignedList.map(item => {
      const dev = item.developer;
      const statusBadge = item.statusTag === 'Available Capacity' 
        ? 'badge-success' 
        : item.statusTag === 'Skill Mismatch' 
          ? 'badge-warning' 
          : 'badge-todo';

      return `
        <div style="padding: 0.625rem 0.75rem; border-bottom: 1px solid var(--border-subtle); font-size: 0.8125rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div class="user-avatar" style="width: 1.625rem; height: 1.625rem; font-size: 0.625rem;">${dev.avatar || 'U'}</div>
              <strong style="color: var(--slate-900); font-size: 0.8125rem;">${dev.name}</strong>
            </div>
            <span class="badge ${statusBadge}" style="font-size: 0.6875rem;">${item.statusTag}</span>
          </div>
          <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.2rem; line-height: 1.35;">
            ${item.reason}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--slate-500); margin-top: 0.25rem;">
            <span>Capacity: <strong>${item.availableHours}h/week</strong></span>
            <span>Skills: ${(item.skills || []).slice(0, 3).join(', ') || 'None'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  assignDeveloperToTask(taskId, developerId) {
    const task = this.storage.getTaskById(taskId);
    if (!task) return;

    if (!developerId) {
      task.assigneeId = null;
      delete task.managerOverride;
      this.storage.saveTask(task);
      this.auth.showToast('Task marked as Unassigned.', 'info');
      this.render();
      return;
    }

    const validation = this.storage.validateAssignment(taskId, developerId, this.activeSprintId);
    if (!validation.valid) {
      this.auth.showToast(validation.error || 'Assignment validation failed.', 'danger');
      return;
    }

    const dev = validation.developer;

    if (validation.requiresOverride) {
      const issueBullets = validation.issues.map((iss, i) => `  ${i + 1}. ${iss}`).join('\n');
      const proceed = confirm(
        `⚠️ Project Manager Authorization Override Required\n\n` +
        `Assigning "${task.title}" to ${dev.name} has the following policy exceptions:\n\n` +
        `${issueBullets}\n\n` +
        `Do you want to explicitly authorize this allocation override?`
      );

      if (!proceed) {
        this.render();
        return;
      }

      task.managerOverride = {
        authorizedAt: new Date().toISOString(),
        authorizedBy: this.auth.getCurrentUser()?.name || 'Project Manager',
        reasons: validation.issues
      };
    } else {
      delete task.managerOverride;
    }

    task.assigneeId = developerId;
    this.storage.saveTask(task);
    this.auth.showToast(`Assigned to ${dev.name}${validation.requiresOverride ? ' (PM Override)' : ''}`, 'success');
    this.render();
  }

  updateSprintStatus(sprintId, newStatus) {
    const sprint = this.storage.getSprintById(sprintId);
    if (!sprint) return;

    sprint.status = newStatus;
    this.storage.saveSprint(sprint);
    this.auth.showToast(`Sprint status updated to ${newStatus}`, 'success');
    this.populateSprintDropdown();
    this.render();
  }

  showRecommendationModal(taskId) {
    const task = this.storage.getTaskById(taskId);
    if (!task) return;

    const modalBackdrop = document.getElementById('rec-modal-backdrop');
    const modalContent = document.getElementById('rec-modal-content');
    if (!modalBackdrop || !modalContent) return;

    const recResult = this.storage.recommendDevelopersForTask(task, this.activeSprintId);
    const recommendations = (recResult && recResult.recommendations) ? recResult.recommendations : [];

    modalContent.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <h4 style="font-size: 1rem; font-weight: 700; color: var(--slate-900); margin-bottom: 0.25rem;">${task.id}: ${task.title}</h4>
        <div style="font-size: 0.8125rem; color: var(--text-muted);">
          Estimate: <strong>${task.estimatedHours}h</strong> (${task.storyPoints} SP) | Required Skills: ${(task.requiredSkills || []).join(', ') || 'None'}
        </div>
      </div>

      <div style="background-color: var(--slate-50); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.875rem; margin-bottom: 1.25rem; font-size: 0.8125rem;">
        <strong style="color: var(--primary);">📐 Transparent Scoring Formula:</strong>
        <ul style="margin-left: 1.25rem; margin-top: 0.35rem; color: var(--slate-700);">
          <li><strong>Skill Match (up to 50 pts):</strong> Ratio of required task skills possessed by the developer.</li>
          <li><strong>Availability & Workload (up to 30 pts):</strong> Based on remaining weekly hours in sprint. 0 pts if capacity exceeded!</li>
          <li><strong>Experience Level (up to 20 pts):</strong> Senior (20 pts), Mid (15 pts), Junior (10 pts).</li>
        </ul>
      </div>

      <div class="rec-candidates-list">
        ${recommendations.length === 0 ? `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.875rem;">
            👥 ${recResult.message || 'No registered developers available in system. Add developers to generate recommendations.'}
          </div>
        ` : recommendations.map(rec => {
          const dev = rec.developer;
          const bd = rec.breakdown;
          const isSelected = task.assigneeId === dev.id;
          return `
            <div class="rec-card ${isSelected ? 'top-match' : ''}">
              <div class="rec-card-header">
                <div class="rec-dev-info">
                  <div class="user-avatar">${dev.avatar}</div>
                  <div>
                    <strong style="font-size: 0.9375rem;">${dev.name}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${dev.title}</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div class="rec-score-pill ${rec.matchBadge}">${rec.totalScore}%</div>
                  <button class="btn btn-sm ${isSelected ? 'btn-secondary' : 'btn-primary'}" onclick="window.sprintPlanningController.assignDeveloperToTask('${task.id}', '${dev.id}'); window.sprintPlanningController.closeRecModal();">
                    ${isSelected ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>
              <div class="rec-breakdown">
                <div>Skills: <strong>${bd.skillScore}/50</strong> (${bd.matchedSkills.join(', ') || 'No match'})</div>
                <div style="color: ${bd.willExceedCapacity ? 'var(--danger)' : 'inherit'};">
                  Load: <strong>${bd.workloadScore}/30</strong> (${bd.currentLoadHours}h → ${bd.projectedLoadHours}h/${bd.capacityHours}h)
                </div>
                <div>Experience: <strong>${bd.experienceScore}/20</strong> (${bd.experienceLevel})</div>
              </div>
              ${bd.willExceedCapacity ? `
                <div class="workload-alert-badge">
                  ⚠️ Overload: Exceeds capacity by ${bd.excessHours} hours!
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    modalBackdrop.classList.add('show');
  }

  closeRecModal() {
    const modalBackdrop = document.getElementById('rec-modal-backdrop');
    if (modalBackdrop) modalBackdrop.classList.remove('show');
  }

  openCreateSprintModal() {
    const modal = document.getElementById('create-sprint-modal');
    if (!modal) return;

    // Defaults
    const today = new Date().toISOString().split('T')[0];
    const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    document.getElementById('new-sprint-name').value = `Sprint ${this.storage.getSprintsByProject(this.activeProjectId).length + 1}`;
    document.getElementById('new-sprint-goal').value = '';
    document.getElementById('new-sprint-start').value = today;
    document.getElementById('new-sprint-end').value = in14Days;
    document.getElementById('new-sprint-pts').value = 35;
    document.getElementById('new-sprint-hrs').value = 120;

    modal.classList.add('show');
  }

  closeCreateSprintModal() {
    const modal = document.getElementById('create-sprint-modal');
    if (modal) modal.classList.remove('show');
  }

  handleCreateSprintSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('new-sprint-name').value.trim();
    const goal = document.getElementById('new-sprint-goal').value.trim();
    const startDate = document.getElementById('new-sprint-start').value;
    const endDate = document.getElementById('new-sprint-end').value;
    const capacityPoints = parseInt(document.getElementById('new-sprint-pts').value) || 30;
    const capacityHours = parseInt(document.getElementById('new-sprint-hrs').value) || 100;

    if (!name) {
      this.auth.showToast('Please provide a sprint name.', 'danger');
      return;
    }

    if (endDate <= startDate) {
      this.auth.showToast('Sprint End Date must be after Start Date.', 'danger');
      return;
    }

    const sprint = {
      projectId: this.activeProjectId,
      name,
      goal,
      startDate,
      endDate,
      status: 'Planned',
      capacityPoints,
      capacityHours
    };

    const saved = this.storage.saveSprint(sprint);
    if (saved) {
      this.auth.showToast(`Sprint "${saved.name}" created!`, 'success');
      this.closeCreateSprintModal();
      this.activeSprintId = saved.id;
      this.populateSprintDropdown();
      this.render();
    }
  }

  bindEvents() {
    const form = document.getElementById('new-sprint-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCreateSprintSubmit(e));
    }
  }
}

window.sprintPlanningController = new SprintPlanningController();
