/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Tasks Controller - Creation, Details, Status Transitions & Effort Logging
 */

class TasksController {
  constructor() {
    this.activeSkills = new Set();
  }

  get storage() {
    return window.storageManager;
  }

  get auth() {
    return window.authManager;
  }

  // ==========================================
  // CREATE / EDIT TASK PAGE CONTROLLER
  // ==========================================
  initCreateOrEditPage() {
    this.auth.renderNavbar('create-task');
    this.auth.checkPageAccess(['admin', 'manager', 'developer']);

    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('id');
    const preselectedProject = urlParams.get('projectId') || this.storage.getActiveProjectId();

    this.populateProjectDropdown(preselectedProject);
    this.populateSprintDropdown(preselectedProject);
    this.populateAssigneeDropdown();
    this.initSkillSuggestions();

    if (taskId) {
      this.loadTaskForEdit(taskId);
    } else {
      // Auto-suggest next Task ID
      const tasks = this.storage.getTasks();
      const nextId = `TSK-${100 + tasks.length + 1}`;
      const idInput = document.getElementById('task-id');
      if (idInput) idInput.value = nextId;

      // Default deadline: 5 days from now
      const in5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const deadlineInput = document.getElementById('task-deadline');
      if (deadlineInput) deadlineInput.value = in5Days;

      this.triggerRecommendationCalculation();
    }

    this.bindCreateTaskEvents();
  }

  populateProjectDropdown(selectedId = null) {
    const select = document.getElementById('task-project');
    if (!select) return;
    const projects = this.storage.getProjects();
    select.innerHTML = projects.map(p => `
      <option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>
        ${p.id} - ${p.name}
      </option>
    `).join('');

    select.addEventListener('change', () => {
      this.populateSprintDropdown(select.value);
      this.triggerRecommendationCalculation();
    });
  }

  populateSprintDropdown(projectId, selectedSprintId = null) {
    const select = document.getElementById('task-sprint');
    if (!select) return;
    const sprints = this.storage.getSprintsByProject(projectId);

    let html = `<option value="">📁 Backlog (No Sprint)</option>`;
    sprints.forEach(s => {
      html += `
        <option value="${s.id}" ${s.id === selectedSprintId ? 'selected' : ''}>
          🏃 ${s.name} (${s.status})
        </option>
      `;
    });
    select.innerHTML = html;

    select.addEventListener('change', () => {
      this.triggerRecommendationCalculation();
    });
  }

  populateAssigneeDropdown(selectedId = null) {
    const select = document.getElementById('task-assignee');
    if (!select) return;
    const devs = this.storage.getDevelopers();

    select.innerHTML = `
      <option value="">👤 Unassigned</option>
      ${devs.map(d => `
        <option value="${d.id}" ${d.id === selectedId ? 'selected' : ''}>
          ${d.name} (${d.title}) - Cap: ${d.maxWeeklyHours}h/wk
        </option>
      `).join('')}
    `;
  }

  initSkillSuggestions() {
    const container = document.getElementById('skill-suggestions-container');
    if (!container) return;

    // Aggregate all unique skills from users
    const allSkills = new Set();
    this.storage.getUsers().forEach(u => {
      (u.skills || []).forEach(s => allSkills.add(s));
    });

    // Common agile tech skills
    ['JavaScript', 'Docker', 'AWS', 'Node.js', 'React', 'SQL', 'PostgreSQL', 'Python', 'Security', 'Testing', 'CI/CD', 'UI/UX'].forEach(s => allSkills.add(s));

    container.innerHTML = Array.from(allSkills).map(skill => `
      <button type="button" class="skill-tag" style="cursor: pointer; border: 1px dashed var(--slate-300);" onclick="window.tasksController.addSkillTag('${skill}')">
        + ${skill}
      </button>
    `).join('');
  }

  addSkillTag(skillName) {
    const clean = skillName.trim();
    if (!clean) return;
    this.activeSkills.add(clean);
    this.renderActiveSkillTags();
    this.triggerRecommendationCalculation();
  }

  removeSkillTag(skillName) {
    this.activeSkills.delete(skillName);
    this.renderActiveSkillTags();
    this.triggerRecommendationCalculation();
  }

  renderActiveSkillTags() {
    const container = document.getElementById('active-skills-container');
    if (!container) return;

    if (this.activeSkills.size === 0) {
      container.innerHTML = `<span style="font-size: 0.8125rem; color: var(--text-muted); font-style: italic;">No specific skills specified yet. Click suggestions below or type custom skill.</span>`;
      return;
    }

    container.innerHTML = Array.from(this.activeSkills).map(s => `
      <span class="skill-tag matched" style="font-size: 0.8125rem; padding: 0.3rem 0.6rem;">
        ${s}
        <button type="button" onclick="window.tasksController.removeSkillTag('${s}')" style="background:none; border:none; color:#065f46; cursor:pointer; font-weight:bold; margin-left:0.3rem;">&times;</button>
      </span>
    `).join('');
  }

  loadTaskForEdit(taskId) {
    const task = this.storage.getTaskById(taskId);
    if (!task) {
      this.auth.showToast(`Task ${taskId} not found.`, 'danger');
      return;
    }

    document.getElementById('page-heading').textContent = `Edit Task: ${task.id}`;
    document.getElementById('page-subheading').textContent = `Modify specifications, estimate, and assignment for ${task.title}`;
    document.getElementById('submit-btn').textContent = '💾 Update Task';

    const idInput = document.getElementById('task-id');
    if (idInput) {
      idInput.value = task.id;
      idInput.disabled = true;
    }

    document.getElementById('task-title').value = task.title || '';
    document.getElementById('task-desc').value = task.description || '';
    document.getElementById('task-project').value = task.projectId || '';
    this.populateSprintDropdown(task.projectId, task.sprintId);
    document.getElementById('task-type').value = task.type || 'Feature';
    document.getElementById('task-priority').value = task.priority || 'Medium';
    document.getElementById('task-status').value = task.status || 'To Do';
    document.getElementById('task-story-points').value = task.storyPoints || 3;
    document.getElementById('task-est-hours').value = task.estimatedHours || 8;
    document.getElementById('task-deadline').value = task.deadline || '';

    this.populateAssigneeDropdown(task.assigneeId);

    this.activeSkills = new Set(task.requiredSkills || []);
    this.renderActiveSkillTags();
    this.triggerRecommendationCalculation();
  }

  bindCreateTaskEvents() {
    // Custom skill add button
    const addCustomBtn = document.getElementById('btn-add-custom-skill');
    const customInput = document.getElementById('custom-skill-input');
    if (addCustomBtn && customInput) {
      const addHandler = () => {
        if (customInput.value.trim()) {
          this.addSkillTag(customInput.value.trim());
          customInput.value = '';
        }
      };
      addCustomBtn.addEventListener('click', addHandler);
      customInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addHandler();
        }
      });
    }

    // Dynamic inputs that impact recommendation
    ['task-est-hours', 'task-sprint'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.triggerRecommendationCalculation());
        el.addEventListener('change', () => this.triggerRecommendationCalculation());
      }
    });

    // Form submit
    const form = document.getElementById('task-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSaveTask();
      });
    }
  }

  /**
   * Run the explainable recommendation algorithm and render ranked cards
   */
  triggerRecommendationCalculation() {
    const container = document.getElementById('recommendations-container');
    if (!container) return;

    const estHours = parseFloat(document.getElementById('task-est-hours')?.value) || 8;
    const sprintId = document.getElementById('task-sprint')?.value || null;
    const projectId = document.getElementById('task-project')?.value || this.storage.getActiveProjectId();
    const currentAssignee = document.getElementById('task-assignee')?.value;

    const draftTask = {
      projectId,
      sprintId,
      estimatedHours: estHours,
      requiredSkills: Array.from(this.activeSkills)
    };

    const recResult = this.storage.recommendDevelopersForTask(draftTask, sprintId);
    const recommendations = recResult.recommendations || [];

    if (!recResult.hasData || recommendations.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1rem;">
          <div style="font-size: 1.75rem; margin-bottom: 0.35rem;">👥</div>
          <strong style="color: var(--slate-800); font-size: 0.9375rem;">No Developer Profiles Available</strong>
          <p class="empty-state-text" style="font-size: 0.8125rem; margin-top: 0.25rem;">
            ${recResult.message || 'Register developers with skill profiles in the Admin Dashboard to evaluate rule-based capacity and skill matching.'}
          </p>
        </div>
      `;
      return;
    }

    const top3 = this.showAllCandidates ? recommendations : (recResult.topRecommendations || recommendations.slice(0, 3));

    container.innerHTML = `
      <div class="rec-title-bar" style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <span class="rec-badge-label" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #fff; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700;">
            🤖 Feature 1: Top 3 Recommendations
          </span>
          <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.2rem;">
            5-Factor Scoring: Skills (40%), Experience (20%), Availability (20%), Workload (15%), Historical (5%)
          </div>
        </div>

        <div style="display: flex; gap: 0.4rem;">
          <button type="button" class="btn btn-sm btn-secondary" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" onclick="window.tasksController.openComparisonModal()">
            ⚖️ Compare Top 3
          </button>
          <button type="button" class="btn btn-sm btn-link" style="font-size: 0.75rem; padding: 0.2rem;" onclick="window.tasksController.toggleShowAllCandidates()">
            ${this.showAllCandidates ? 'Show Top 3 Only' : `Show All (${recResult.totalEligible})`}
          </button>
        </div>
      </div>

      <div class="rec-candidates-list">
        ${top3.map((rec) => {
          const dev = rec.developer;
          const isSelected = currentAssignee === dev.id;
          const isRank1 = rec.rank === 1 && !rec.willExceedCapacity;

          return `
            <div class="rec-card ${isRank1 ? 'top-match' : ''}" style="margin-bottom: 1rem; border-left: 4px solid ${rec.rank === 1 ? 'var(--primary)' : 'var(--slate-300)'};">
              <!-- Card Header -->
              <div class="rec-card-header">
                <div class="rec-dev-info">
                  <div class="user-avatar" style="width: 2.5rem; height: 2.5rem;">${dev.avatar}</div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                      <span class="badge ${rec.rank === 1 ? 'badge-active' : 'badge-archived'}" style="font-weight: 800;">
                        RANK #${rec.rank} ${rec.rank === 1 ? '⭐ BEST MATCH' : 'ALTERNATIVE'}
                      </span>
                      <strong style="font-size: 0.9375rem; color: var(--slate-900);">${dev.name}</strong>
                      <span class="task-id" style="font-size: 0.6875rem;">[${dev.id}]</span>
                      <span class="badge ${dev.experienceLevel === 'Senior' ? 'badge-priority-high' : 'badge-priority-medium'}">${dev.experienceLevel}</span>
                      ${isSelected ? `<span class="badge badge-done">✓ Currently Selected</span>` : ''}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">
                      ${dev.title} &bull; ${rec.experienceSuitability}
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div class="rec-score-pill ${rec.matchBadge}">
                    ${rec.totalScore}% MATCH
                  </div>
                  <button type="button" class="btn btn-sm ${isSelected ? 'btn-secondary' : 'btn-primary'}" onclick="window.tasksController.selectCandidate('${dev.id}', ${rec.willExceedCapacity}, ${rec.excessHours})">
                    ${isSelected ? '✓ Assigned' : (rec.willExceedCapacity ? '⚠️ Request Override' : '👉 Select')}
                  </button>
                </div>
              </div>

              <!-- Skills Comparison -->
              <div style="margin: 0.65rem 0; font-size: 0.75rem;">
                <div style="margin-bottom: 0.25rem;">
                  <strong>Skills Compatibility:</strong> <span style="font-weight: 700; color: ${rec.skillMatchPercent === 100 ? 'var(--success)' : 'var(--slate-800)'};">${rec.skillMatchPercent}%</span>
                </div>
                <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                  ${rec.matchedSkills.map(s => `<span class="badge badge-done" style="font-size: 0.625rem;">✓ ${s}</span>`).join('')}
                  ${rec.missingSkills.map(s => `<span class="badge badge-priority-high" style="font-size: 0.625rem;">✕ ${s} (Missing)</span>`).join('')}
                  ${rec.matchedSkills.length === 0 && rec.missingSkills.length === 0 ? '<span style="color: var(--text-muted); font-style: italic;">No specific skill prerequisites</span>' : ''}
                </div>
              </div>

              <!-- Capacity & Workload Balance -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.75rem; background: var(--slate-50); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); margin-bottom: 0.65rem;">
                <div>
                  <span style="color: var(--text-muted);">Available Capacity:</span>
                  <div><strong>${rec.availableWorkingHours}h</strong> remaining / ${rec.maxWeeklyHours}h max</div>
                </div>
                <div>
                  <span style="color: var(--text-muted);">Current Assigned Workload:</span>
                  <div><strong>${rec.currentWorkloadHours}h</strong> currently booked</div>
                </div>
              </div>

              <!-- Recommendation Reasons -->
              <div style="font-size: 0.75rem; margin-bottom: 0.5rem;">
                <strong style="color: var(--slate-900);">Why Recommended:</strong>
                <ul style="margin: 0.2rem 0 0 0; padding-left: 1.25rem; color: var(--slate-700);">
                  ${rec.recommendationReasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
              </div>

              <!-- Potential Risks -->
              ${rec.potentialRisks.length > 0 ? `
                <div class="alert alert-danger" style="margin-bottom: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.75rem;">
                  <strong style="display: block; margin-bottom: 0.2rem;">⚠️ Potential Assignment Risks:</strong>
                  <ul style="margin: 0; padding-left: 1.25rem;">
                    ${rec.potentialRisks.map(r => `<li>${r}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}

              <!-- Reasons Why Other Candidates Were Ranked Lower (for Rank > 1) -->
              ${rec.rank > 1 && rec.notRecommendedReasons && rec.notRecommendedReasons.length > 0 ? `
                <div style="font-size: 0.6875rem; color: var(--text-muted); background: #f8fafc; padding: 0.35rem 0.6rem; border-radius: var(--radius-sm); border: 1px dashed var(--slate-300);">
                  ℹ️ <strong>Rank #${rec.rank} Rationale:</strong> ${rec.notRecommendedReasons.join('; ')}
                </div>
              ` : ''}

              <!-- Disclosures -->
              ${rec.disclosures && rec.disclosures.length > 0 ? `
                <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.35rem; font-style: italic;">
                  Disclosed: ${rec.disclosures[0]}
                </div>
              ` : ''}

            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  toggleShowAllCandidates() {
    this.showAllCandidates = !this.showAllCandidates;
    this.triggerRecommendationCalculation();
  }

  openComparisonModal() {
    const estHours = parseFloat(document.getElementById('task-est-hours')?.value) || 8;
    const sprintId = document.getElementById('task-sprint')?.value || null;
    const projectId = document.getElementById('task-project')?.value || this.storage.getActiveProjectId();

    const draftTask = {
      projectId,
      sprintId,
      estimatedHours: estHours,
      requiredSkills: Array.from(this.activeSkills)
    };

    const compData = this.storage.compareCandidatesForTask(draftTask, [], sprintId);
    if (!compData || compData.candidates.length === 0) {
      this.auth.showToast('No candidates available to compare.', 'info');
      return;
    }

    let modal = document.getElementById('task-candidate-comparison-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'task-candidate-comparison-modal';
      modal.className = 'modal';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 900px;">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">⚖️ Compare Top 3 Recommended Developers</h3>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.8125rem; color: var(--text-muted);">
              Side-by-side evaluation across skills, experience, availability, and workload balance.
            </p>
          </div>
          <button class="modal-close" onclick="document.getElementById('task-candidate-comparison-modal').style.display='none'">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
            ${compData.candidates.map(cand => `
              <div class="card" style="border-top: 4px solid ${cand.rank === 1 ? 'var(--primary)' : 'var(--slate-300)'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span class="badge ${cand.rank === 1 ? 'badge-active' : 'badge-archived'}">RANK #${cand.rank}</span>
                  <span class="rec-score-pill ${cand.matchBadge}">${cand.totalScore}% MATCH</span>
                </div>
                <h4 style="margin: 0; font-size: 1.1rem; color: var(--slate-900);">${cand.developerName}</h4>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">${cand.jobTitle} &bull; ${cand.experienceLevel}</div>

                <div style="font-size: 0.8125rem; margin-bottom: 0.5rem;">
                  <strong>Skills:</strong> ${cand.matchedSkills.length > 0 ? cand.matchedSkills.join(', ') : 'No exact match'}
                </div>
                ${cand.missingSkills.length > 0 ? `
                  <div style="font-size: 0.8125rem; color: var(--danger); margin-bottom: 0.5rem;">
                    <strong>Missing:</strong> ${cand.missingSkills.join(', ')}
                  </div>
                ` : ''}

                <div style="font-size: 0.8125rem; margin-bottom: 0.5rem;">
                  <strong>Capacity:</strong> ${cand.availableWorkingHours}h avail / ${cand.maxWeeklyHours}h limit
                </div>
                <div style="font-size: 0.8125rem; margin-bottom: 0.75rem;">
                  <strong>Workload:</strong> ${cand.currentWorkloadHours}h currently assigned
                </div>

                <div class="alert alert-info" style="font-size: 0.75rem; padding: 0.5rem; margin-bottom: 0.75rem;">
                  ${cand.recommendationReasons.slice(0, 2).map(r => `<div>&bull; ${r}</div>`).join('')}
                </div>

                ${cand.potentialRisks.length > 0 ? `
                  <div class="alert alert-danger" style="font-size: 0.75rem; padding: 0.5rem; margin-bottom: 0.75rem;">
                    ${cand.potentialRisks.map(r => `<div>${r}</div>`).join('')}
                  </div>
                ` : ''}

                <button type="button" class="btn btn-sm ${cand.rank === 1 ? 'btn-primary' : 'btn-secondary'}" style="width: 100%;" onclick="window.tasksController.selectCandidate('${cand.developerId}', ${cand.willExceedCapacity}, ${cand.excessHours}); document.getElementById('task-candidate-comparison-modal').style.display='none';">
                  Select Candidate #${cand.rank} &rarr;
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  selectCandidate(developerId, willExceed, excessHours) {
    const select = document.getElementById('task-assignee');
    if (!select) return;

    if (willExceed) {
      const confirmAssign = confirm(`⚠️ Workload Warning: This developer will exceed their safe weekly capacity by ${excessHours} hours. An explicit Project Manager override will be recorded upon save. Do you want to select this developer?`);
      if (!confirmAssign) return;
    }

    select.value = developerId;
    const dev = this.storage.getUserById(developerId);
    this.auth.showToast(`Selected developer: ${dev ? dev.name : developerId}`, 'info');
    this.triggerRecommendationCalculation();
  }

  handleSaveTask() {
    const id = document.getElementById('task-id').value.trim();
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-desc').value.trim();
    const projectId = document.getElementById('task-project').value;
    const sprintId = document.getElementById('task-sprint').value || null;
    const type = document.getElementById('task-type').value;
    const priority = document.getElementById('task-priority').value;
    const status = document.getElementById('task-status').value;
    const storyPoints = parseInt(document.getElementById('task-story-points').value) || 1;
    const estimatedHours = parseFloat(document.getElementById('task-est-hours').value) || 1;
    const deadline = document.getElementById('task-deadline').value;
    const assigneeId = document.getElementById('task-assignee').value || null;

    if (!id) {
      this.auth.showToast('Please specify a Task ID.', 'danger');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const editingId = urlParams.get('id');
    if (!editingId && this.storage.getTaskById(id)) {
      this.auth.showToast(`A task with ID "${id}" already exists. Please choose a unique Task ID.`, 'danger');
      return;
    }

    if (!projectId) {
      this.auth.showToast('Please select a project for this task.', 'danger');
      return;
    }

    if (!title) {
      this.auth.showToast('Please enter a task title.', 'danger');
      return;
    }

    // Check workload and skill requirements with PM override control
    let managerOverride = null;
    if (assigneeId) {
      const dev = this.storage.getUserById(assigneeId);
      const issues = [];
      const workload = this.storage.calculateDeveloperWorkload(assigneeId, sprintId);
      const postHours = (workload ? workload.assignedHours : 0) + estimatedHours;
      const maxCapacity = dev ? (dev.maxWeeklyHours || 40) : 40;

      if (postHours > maxCapacity) {
        const excess = Math.round((postHours - maxCapacity) * 10) / 10;
        issues.push(`Capacity Exceeded: Increases load to ${postHours}h / ${maxCapacity}h (exceeds weekly limit by ${excess}h).`);
      }

      const skillEval = this.storage.calculateSkillMatch(Array.from(this.activeSkills), dev ? dev.skills : []);
      if (this.activeSkills.size > 0 && skillEval.matchedSkills.length === 0) {
        issues.push(`Skill Requirement Not Met: Developer lacks required skills [${Array.from(this.activeSkills).join(', ')}].`);
      }

      if (issues.length > 0) {
        const proceed = confirm(
          `⚠️ Project Manager Authorization Override Required\n\n` +
          `Assigning this task to ${dev.name} has the following policy exceptions:\n\n` +
          issues.map((iss, i) => `  ${i + 1}. ${iss}`).join('\n') +
          `\n\nDo you want to explicitly authorize this allocation override?`
        );
        if (!proceed) return;

        managerOverride = {
          authorizedAt: new Date().toISOString(),
          authorizedBy: this.auth.getCurrentUser()?.name || 'Project Manager',
          reasons: issues
        };
      }
    }

    const taskData = {
      id,
      title,
      description,
      projectId,
      sprintId,
      type,
      priority,
      status,
      storyPoints,
      estimatedHours,
      deadline,
      assigneeId,
      managerOverride,
      requiredSkills: Array.from(this.activeSkills)
    };

    const saved = this.storage.saveTask(taskData);
    if (saved) {
      this.auth.showToast(`Task "${saved.title}" saved successfully!`, 'success');
      setTimeout(() => {
        window.location.href = `task-details.html?id=${saved.id}`;
      }, 500);
    } else {
      this.auth.showToast('Failed to save task.', 'danger');
    }
  }

  // ==========================================
  // TASK DETAILS & EFFORT LOGGING CONTROLLER
  // ==========================================
  initDetailsPage() {
    this.auth.renderNavbar();
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('id');

    if (!taskId) {
      this.renderTaskNotFound();
      return;
    }

    const task = this.storage.getTaskById(taskId);
    if (!task) {
      this.renderTaskNotFound();
      return;
    }

    this.renderTaskDetails(task);
    this.bindDetailsEvents(task);
  }

  renderTaskNotFound() {
    const main = document.getElementById('task-details-main');
    if (main) {
      main.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">Task Not Found</div>
          <div class="empty-state-text">The requested task does not exist or has been deleted.</div>
          <a href="manager.html" class="btn btn-primary">Return to PM Dashboard</a>
        </div>
      `;
    }
  }

  renderTaskDetails(task) {
    const project = this.storage.getProjectById(task.projectId);
    const sprint = task.sprintId ? this.storage.getSprintById(task.sprintId) : null;
    const assignee = task.assigneeId ? this.storage.getUserById(task.assigneeId) : null;
    const risk = this.storage.calculateTaskRisk(task);

    // Header & Meta
    document.getElementById('task-badge-id').textContent = task.id;
    document.getElementById('task-title').textContent = task.title;
    document.getElementById('task-project-name').textContent = project ? `${project.id} - ${project.name}` : 'Unknown Project';
    document.getElementById('task-sprint-name').textContent = sprint ? sprint.name : 'Backlog (No Sprint)';
    document.getElementById('task-description').textContent = task.description || 'No detailed description provided.';

    // Status & Priority
    const statusSelect = document.getElementById('task-status-select');
    if (statusSelect) statusSelect.value = task.status;

    const priorityBadge = document.getElementById('task-priority-badge');
    if (priorityBadge) {
      priorityBadge.textContent = task.priority;
      priorityBadge.className = `badge badge-priority-${task.priority.toLowerCase()}`;
    }

    const pointsBadge = document.getElementById('task-points-badge');
    if (pointsBadge) pointsBadge.textContent = `${task.storyPoints} Story Points`;

    // Skills
    const skillsContainer = document.getElementById('task-skills-container');
    if (skillsContainer) {
      if (!task.requiredSkills || task.requiredSkills.length === 0) {
        skillsContainer.innerHTML = `<span style="font-size: 0.8125rem; color: var(--text-muted); font-style: italic;">No specific skills marked for this task.</span>`;
      } else {
        skillsContainer.innerHTML = task.requiredSkills.map(s => {
          const isDevMatch = assignee && (assignee.skills || []).some(ds => ds.toLowerCase() === s.toLowerCase());
          return `
            <span class="skill-tag ${isDevMatch ? 'matched' : ''}">
              ${isDevMatch ? '✓ ' : ''}${s}
            </span>
          `;
        }).join('');
      }
    }

    // Assignee Card
    const assigneeCard = document.getElementById('task-assignee-card');
    if (assigneeCard) {
      if (assignee) {
        const workload = this.storage.calculateDeveloperWorkload(assignee.id, task.sprintId);
        const skillMatch = this.storage.calculateSkillMatch(task.requiredSkills, assignee.skills);
        assigneeCard.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.625rem;">
              <div class="user-avatar" style="width: 2.5rem; height: 2.5rem;">${assignee.avatar}</div>
              <div>
                <strong style="font-size: 0.9375rem; color: var(--slate-900);">${assignee.name}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${assignee.title}</div>
              </div>
            </div>
            <span class="badge ${assignee.experienceLevel === 'Senior' ? 'badge-priority-high' : 'badge-priority-medium'}">${assignee.experienceLevel}</span>
          </div>
          <div style="font-size: 0.8125rem; color: var(--slate-700); margin-bottom: 0.5rem;">
            Skill Match: <strong>${skillMatch.matchPercent}%</strong> (${skillMatch.matchedCount}/${skillMatch.totalRequired} required skills matched)
          </div>
          <div style="font-size: 0.8125rem; color: var(--slate-700);">
            Weekly Load: <strong>${workload.assignedHours}h / ${workload.maxCapacity}h (${workload.utilizationPercent}%)</strong>
          </div>
          ${task.managerOverride ? `
            <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: var(--radius-xs); padding: 0.5rem; margin-top: 0.65rem; font-size: 0.75rem; color: #92400e;">
              <strong>⚠️ Project Manager Authorized Override:</strong>
              <div style="margin-top: 0.2rem;">Authorized by <em>${task.managerOverride.authorizedBy}</em> on ${new Date(task.managerOverride.authorizedAt).toLocaleDateString()}</div>
              <ul style="margin-left: 1.1rem; margin-top: 0.25rem; margin-bottom: 0;">
                ${(task.managerOverride.reasons || []).map(r => `<li>${r}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        `;
      } else {
        assigneeCard.innerHTML = `
          <div style="text-align: center; padding: 1rem; color: var(--text-muted); font-size: 0.875rem;">
            👤 This task is currently <strong>Unassigned</strong>.
            <div style="margin-top: 0.5rem;">
              <a href="create-task.html?id=${task.id}" class="btn btn-sm btn-primary">Assign Developer</a>
            </div>
          </div>
        `;
      }
    }

    // Deadline & Transparent Risk Explainer
    const riskBadge = document.getElementById('task-risk-badge');
    if (riskBadge) {
      riskBadge.textContent = risk.label;
      riskBadge.className = `badge ${risk.badgeClass}`;
    }

    const deadlineText = document.getElementById('task-deadline-text');
    if (deadlineText) {
      deadlineText.textContent = task.deadline || 'No deadline';
    }

    const riskReason = document.getElementById('task-risk-reason');
    if (riskReason) {
      riskReason.textContent = risk.reason;
    }

    // Effort Progress
    const est = parseFloat(task.estimatedHours) || 0;
    const act = parseFloat(task.actualHours) || 0;
    const effortPercent = est > 0 ? Math.min(100, Math.round((act / est) * 100)) : 0;
    const isOverBudget = act > est;

    document.getElementById('effort-ratio-text').textContent = `${act}h logged / ${est}h estimated (${effortPercent}%)`;
    const effortFill = document.getElementById('effort-progress-fill');
    if (effortFill) {
      effortFill.style.width = `${Math.min(100, effortPercent)}%`;
      effortFill.className = `progress-bar-fill ${isOverBudget ? 'danger' : effortPercent >= 80 ? 'warning' : 'success'}`;
    }

    // Work Logs History Table
    this.renderWorkLogs(task.workLogs || []);

    // Action buttons
    const editBtn = document.getElementById('btn-edit-task');
    if (editBtn) editBtn.href = `create-task.html?id=${task.id}`;
  }

  renderWorkLogs(logs) {
    const tableBody = document.getElementById('worklogs-table-body');
    if (!tableBody) return;

    if (logs.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No effort hours recorded yet. Use the form above to log work sessions.
          </td>
        </tr>
      `;
      return;
    }

    // Sort logs descending by date
    const sorted = [...logs].reverse();
    tableBody.innerHTML = sorted.map(log => {
      const user = this.storage.getUserById(log.loggedBy);
      return `
        <tr>
          <td><strong>${log.date}</strong></td>
          <td><span class="badge badge-priority-medium">⏱️ ${log.hours}h</span></td>
          <td>${log.note}</td>
          <td>${user ? user.name : 'Unknown User'}</td>
        </tr>
      `;
    }).join('');
  }

  bindDetailsEvents(task) {
    // Status select change
    const statusSelect = document.getElementById('task-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', () => {
        task.status = statusSelect.value;
        this.storage.saveTask(task);
        this.auth.showToast(`Status updated to ${task.status}`, 'success');
        this.renderTaskDetails(task);
      });
    }

    // Effort logging form
    const effortForm = document.getElementById('log-effort-form');
    if (effortForm) {
      // Set default date to today
      const dateInput = document.getElementById('log-date');
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

      effortForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const hours = parseFloat(document.getElementById('log-hours').value);
        const note = document.getElementById('log-note').value;
        const date = document.getElementById('log-date').value;

        if (!hours || hours <= 0) {
          this.auth.showToast('Please enter a positive number of hours worked.', 'danger');
          return;
        }

        const updated = this.storage.logEffort(task.id, hours, note, date);
        if (updated) {
          this.auth.showToast(`Logged ${hours}h successfully!`, 'success');
          document.getElementById('log-hours').value = '';
          document.getElementById('log-note').value = '';
          this.renderTaskDetails(updated);
        }
      });
    }

    // Delete Task
    const deleteBtn = document.getElementById('btn-delete-task');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete task ${task.id}: "${task.title}"? This action cannot be undone.`)) {
          this.storage.deleteTask(task.id);
          this.auth.showToast(`Task ${task.id} deleted.`, 'info');
          setTimeout(() => {
            window.location.href = 'manager.html';
          }, 400);
        }
      });
    }
  }
}

window.tasksController = new TasksController();
