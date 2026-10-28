/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Developer Controller - Personal Tasks, Skill Matching, and Effort Tracking
 */

class DeveloperController {
  constructor() {
    this.storage = window.storageManager;
    this.auth = window.authManager;
    this.currentDev = null;
    this.loggingTaskId = null;
  }

  init() {
    this.auth.renderNavbar('developer');

    let user = this.auth.getCurrentUser();
    if (!user) {
      this.auth.checkPageAccess(['developer', 'manager', 'admin']);
      return;
    }

    if (user.role !== 'developer') {
      const developers = this.storage.getDevelopers();
      if (developers.length > 0) {
        user = developers[0];
      }
    }

    this.currentDev = user;

    if (!this.currentDev) {
      const container = document.querySelector('.container');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">💻</div>
            <div class="empty-state-title">No Developer Accounts Registered</div>
            <div class="empty-state-text">No developer accounts exist in the workspace yet. Use the Administrator dashboard to create developer team profiles.</div>
            <a href="admin.html" class="btn btn-primary">Go to Admin Dashboard</a>
          </div>
        `;
      }
      return;
    }

    this.renderHeader();
    this.renderMetrics();
    this.renderTasks();
    this.renderEffortHistory();
    this.bindEvents();
  }

  renderHeader() {
    const dev = this.currentDev;
    if (!dev) return;

    document.getElementById('dev-name').textContent = dev.name;
    document.getElementById('dev-title').textContent = dev.title || 'Developer';
    document.getElementById('dev-avatar').textContent = dev.avatar || 'D';
    document.getElementById('dev-level-badge').textContent = `${dev.experienceLevel || 'Mid'} Level`;

    // Skills
    const skillsContainer = document.getElementById('dev-skills-container');
    if (skillsContainer) {
      if (!dev.skills || dev.skills.length === 0) {
        skillsContainer.innerHTML = `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">No skills added to profile yet.</span>`;
      } else {
        skillsContainer.innerHTML = dev.skills.map(s => `
          <span class="skill-tag matched">${s}</span>
        `).join('');
      }
    }

    // Weekly Capacity Utilization
    const workload = this.storage.calculateDeveloperWorkload(dev.id);
    const meterEl = document.getElementById('dev-capacity-meter');
    const textEl = document.getElementById('dev-capacity-text');

    if (textEl && workload) {
      textEl.textContent = `${workload.assignedHours}h assigned / ${workload.maxCapacity}h capacity (${workload.utilizationPercent}%)`;
    }
    if (meterEl && workload) {
      meterEl.style.width = `${Math.min(100, workload.utilizationPercent)}%`;
      meterEl.className = `progress-bar-fill ${workload.isOverloaded ? 'danger' : workload.utilizationPercent >= 80 ? 'warning' : 'success'}`;
    }

    // Warning if overloaded
    const alertBox = document.getElementById('dev-overload-alert');
    if (alertBox) {
      if (workload && workload.isOverloaded) {
        alertBox.style.display = 'flex';
        alertBox.innerHTML = `
          <span>⚠️ <strong>Workload Warning:</strong> You are currently allocated ${workload.assignedHours}h out of your ${workload.maxCapacity}h weekly limit. Contact your Project Manager to rebalance tasks.</span>
        `;
      } else {
        alertBox.style.display = 'none';
      }
    }
  }

  renderMetrics() {
    const dev = this.currentDev;
    const tasks = this.storage.getTasksByAssignee(dev.id);

    const activeTasks = tasks.filter(t => t.status !== 'Done');
    const inProgress = tasks.filter(t => t.status === 'In Progress' || t.status === 'Code Review');
    const completed = tasks.filter(t => t.status === 'Done');

    // Total actual hours logged across tasks
    let totalHoursLogged = 0;
    tasks.forEach(t => {
      (t.workLogs || []).forEach(wl => {
        if (wl.loggedBy === dev.id) {
          totalHoursLogged += (parseFloat(wl.hours) || 0);
        }
      });
    });

    document.getElementById('metric-dev-active').textContent = activeTasks.length;
    document.getElementById('metric-dev-inprogress').textContent = inProgress.length;
    document.getElementById('metric-dev-done').textContent = completed.length;
    document.getElementById('metric-dev-hours').textContent = `${Math.round(totalHoursLogged * 10) / 10}h`;
  }

  renderTasks() {
    const container = document.getElementById('dev-tasks-container');
    if (!container) return;

    const statusFilter = document.getElementById('dev-filter-status')?.value || 'all';
    const priorityFilter = document.getElementById('dev-filter-priority')?.value || 'all';

    let tasks = this.storage.getTasksByAssignee(this.currentDev.id);

    if (statusFilter !== 'all') {
      tasks = tasks.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      tasks = tasks.filter(t => t.priority.toLowerCase() === priorityFilter.toLowerCase());
    }

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <div class="empty-state-title">No Tasks Found</div>
          <div class="empty-state-text">You have no tasks matching the selected filters. Great job!</div>
        </div>
      `;
      return;
    }

    const devSkills = this.currentDev.skills || [];

    container.innerHTML = tasks.map(task => {
      const project = this.storage.getProjectById(task.projectId);
      const sprint = task.sprintId ? this.storage.getSprintById(task.sprintId) : null;
      const risk = this.storage.calculateTaskRisk(task);
      const skillEval = this.storage.calculateSkillMatch(task.requiredSkills, devSkills);

      const est = parseFloat(task.estimatedHours) || 0;
      const act = parseFloat(task.actualHours) || 0;
      const progressPercent = est > 0 ? Math.min(100, Math.round((act / est) * 100)) : 0;

      return `
        <div class="card" style="margin-bottom: 1rem; border-left: 4px solid var(--primary);">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="task-id">${task.id}</span>
                <span class="badge ${risk.badgeClass}">${risk.label}</span>
                <span class="badge badge-priority-${task.priority.toLowerCase()}">${task.priority}</span>
                <span class="task-points-badge">${task.storyPoints} SP</span>
              </div>
              <h3 style="font-size: 1.0625rem; font-weight: 700; color: var(--slate-900); margin: 0.35rem 0;">
                <a href="task-details.html?id=${task.id}" style="color: inherit; text-decoration: none;">${task.title}</a>
              </h3>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                Project: <strong>${project ? project.name : task.projectId}</strong> | Sprint: <strong>${sprint ? sprint.name : 'Backlog'}</strong> | Deadline: <strong>${task.deadline || 'None'}</strong>
              </div>
            </div>

            <!-- Status Dropdown -->
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">Status:</span>
              <select class="form-control" style="width: auto; padding: 0.35rem 0.65rem; font-size: 0.8125rem;" onchange="window.developerController.updateTaskStatus('${task.id}', this.value)">
                <option value="To Do" ${task.status === 'To Do' ? 'selected' : ''}>To Do</option>
                <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Code Review" ${task.status === 'Code Review' ? 'selected' : ''}>Code Review</option>
                <option value="Done" ${task.status === 'Done' ? 'selected' : ''}>Done</option>
              </select>
            </div>
          </div>

          <p style="font-size: 0.875rem; color: var(--slate-700); margin-bottom: 0.75rem;">
            ${task.description || 'No detailed instructions.'}
          </p>

          <!-- Skills Compatibility Row -->
          <div style="background-color: var(--slate-50); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.625rem; margin-bottom: 0.75rem;">
            <div style="font-size: 0.75rem; font-weight: 600; color: var(--slate-700); margin-bottom: 0.35rem;">
              Required Skills Match: <span style="color: var(--success);">${skillEval.matchPercent}%</span> (${skillEval.matchedCount}/${skillEval.totalRequired} matched)
            </div>
            <div class="skill-tags-list">
              ${(task.requiredSkills || []).map(req => {
                const isMatched = devSkills.some(ds => ds.toLowerCase() === req.toLowerCase());
                return `
                  <span class="skill-tag ${isMatched ? 'matched' : 'missing'}">
                    ${isMatched ? '✓' : '✗'} ${req}
                  </span>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Effort and Actions -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle);">
            <div style="flex: 1; min-width: 200px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 0.25rem;">
                <span>Logged: <strong>${act}h / ${est}h</strong></span>
                <span>${progressPercent}% effort</span>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar-fill ${act > est ? 'danger' : 'primary'}" style="width: ${progressPercent}%;"></div>
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-sm btn-primary" onclick="window.developerController.openEffortModal('${task.id}')">
                ⏱️ Log Effort
              </button>
              <a href="task-details.html?id=${task.id}" class="btn btn-sm btn-secondary">
                Details
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderEffortHistory() {
    const tbody = document.getElementById('effort-history-tbody');
    if (!tbody) return;

    const dev = this.currentDev;
    const allTasks = this.storage.getTasks();
    const userLogs = [];

    allTasks.forEach(task => {
      (task.workLogs || []).forEach(wl => {
        if (wl.loggedBy === dev.id) {
          userLogs.push({ ...wl, taskTitle: task.title, taskId: task.id });
        }
      });
    });

    // Sort descending by date
    userLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (userLogs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No work hours logged yet. Click "⏱️ Log Effort" on any task to record time.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = userLogs.map(log => `
      <tr>
        <td><strong>${log.date}</strong></td>
        <td>
          <a href="task-details.html?id=${log.taskId}" style="color: inherit; font-weight: 500;">
            ${log.taskId}: ${log.taskTitle}
          </a>
        </td>
        <td><span class="badge badge-priority-medium">⏱️ ${log.hours}h</span></td>
        <td>${log.note}</td>
      </tr>
    `).join('');
  }

  updateTaskStatus(taskId, newStatus) {
    const task = this.storage.getTaskById(taskId);
    if (!task) return;

    task.status = newStatus;
    this.storage.saveTask(task);
    this.auth.showToast(`Status updated to ${newStatus}`, 'success');
    this.renderHeader();
    this.renderMetrics();
    this.renderTasks();
  }

  openEffortModal(taskId) {
    const task = this.storage.getTaskById(taskId);
    if (!task) return;

    this.loggingTaskId = taskId;
    document.getElementById('modal-effort-task-title').textContent = `${task.id}: ${task.title}`;
    document.getElementById('modal-effort-hours').value = '4';
    document.getElementById('modal-effort-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-effort-note').value = '';

    document.getElementById('effort-modal').classList.add('show');
  }

  closeEffortModal() {
    document.getElementById('effort-modal').classList.remove('show');
  }

  handleSaveEffort(e) {
    e.preventDefault();
    if (!this.loggingTaskId) return;

    const hours = parseFloat(document.getElementById('modal-effort-hours').value);
    const date = document.getElementById('modal-effort-date').value;
    const note = document.getElementById('modal-effort-note').value.trim();

    if (!hours || hours <= 0) {
      this.auth.showToast('Please enter a valid number of hours worked.', 'danger');
      return;
    }

    const updated = this.storage.logEffort(this.loggingTaskId, hours, note, date);
    if (updated) {
      this.auth.showToast(`Logged ${hours}h successfully!`, 'success');
      this.closeEffortModal();
      this.renderHeader();
      this.renderMetrics();
      this.renderTasks();
      this.renderEffortHistory();
    }
  }

  bindEvents() {
    document.getElementById('dev-filter-status')?.addEventListener('change', () => this.renderTasks());
    document.getElementById('dev-filter-priority')?.addEventListener('change', () => this.renderTasks());
    document.getElementById('effort-modal-form')?.addEventListener('submit', (e) => this.handleSaveEffort(e));
  }
}

window.developerController = new DeveloperController();
