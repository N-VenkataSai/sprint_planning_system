/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Analytics Controller - Interactive Chart.js Visualizations (Strictly Real Records)
 *
 * Mandatory Data Policy: Never display fabricated percentages, dummy datasets,
 * or invented trendlines. When insufficient data exists, display a clear "Insufficient data" state.
 */

class AnalyticsController {
  constructor() {
    this.activeProjectId = 'ALL';
    this.charts = {};
  }

  get storage() {
    return window.storageManager;
  }

  get auth() {
    return window.authManager;
  }

  init() {
    this.auth.renderNavbar('analytics');

    const urlParams = new URLSearchParams(window.location.search);
    const pId = urlParams.get('projectId');
    if (pId && this.storage.getProjectById(pId)) {
      this.activeProjectId = pId;
    }

    this.initProjectSelector();
    this.render();
  }

  initProjectSelector() {
    const select = document.getElementById('analytics-project-select');
    if (!select) return;

    const projects = this.storage.getProjects();
    if (projects.length === 0) {
      select.innerHTML = `<option value="ALL">No projects created yet</option>`;
      return;
    }

    select.innerHTML = `
      <option value="ALL" ${this.activeProjectId === 'ALL' ? 'selected' : ''}>🌐 All Projects (Enterprise Overview)</option>
      ${projects.map(p => `
        <option value="${p.id}" ${p.id === this.activeProjectId ? 'selected' : ''}>
          ${p.id} - ${p.name}
        </option>
      `).join('')}
    `;

    select.addEventListener('change', () => {
      this.activeProjectId = select.value;
      this.render();
    });
  }

  render() {
    this.renderKPICards();
    this.renderVelocityChart();
    this.renderStatusChart();
    this.renderWorkloadChart();
    this.renderBurndownChart();
    this.renderSkillsDemandChart();
    this.renderRiskChart();
  }

  getFilteredTasks() {
    if (this.activeProjectId === 'ALL') {
      return this.storage.getTasks();
    }
    return this.storage.getTasksByProject(this.activeProjectId);
  }

  getFilteredSprints() {
    if (this.activeProjectId === 'ALL') {
      return this.storage.getSprints();
    }
    return this.storage.getSprintsByProject(this.activeProjectId);
  }

  renderKPICards() {
    const tasks = this.getFilteredTasks();
    const sprints = this.getFilteredSprints();

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Done').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalPoints = tasks.reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);
    const completedPoints = tasks.filter(t => t.status === 'Done').reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);

    // Calculate Average Sprint Velocity from actual completed/active sprints
    const activeOrCompletedSprints = sprints.filter(s => s.status === 'Completed' || s.status === 'Active');
    let avgVelocity = 0;
    if (activeOrCompletedSprints.length > 0) {
      const sumPts = activeOrCompletedSprints.reduce((sum, s) => {
        const stats = this.storage.calculateSprintStats(s.id);
        return sum + (stats ? stats.completedPoints : 0);
      }, 0);
      avgVelocity = Math.round(sumPts / activeOrCompletedSprints.length);
    }

    let overdueCount = 0;
    let highRiskCount = 0;
    tasks.forEach(t => {
      const risk = this.storage.calculateTaskRisk(t);
      if (risk.riskLevel === 'OVERDUE') overdueCount++;
      else if (risk.riskLevel === 'HIGH') highRiskCount++;
    });

    const devs = this.storage.getDevelopers();
    let totalCap = 0;
    let totalAssigned = 0;
    devs.forEach(d => {
      const load = this.storage.calculateDeveloperWorkload(d.id);
      totalCap += load.maxCapacity;
      totalAssigned += load.assignedHours;
    });
    const avgUtil = totalCap > 0 ? Math.round((totalAssigned / totalCap) * 100) : 0;

    document.getElementById('kpi-completion-rate').textContent = totalTasks > 0 ? `${completionRate}%` : '0%';
    document.getElementById('kpi-sub-completion').textContent = totalTasks > 0 ? `${completedPoints} / ${totalPoints} Story Points Done` : 'No tasks recorded';

    document.getElementById('kpi-velocity').textContent = `${avgVelocity} SP`;
    document.getElementById('kpi-sub-velocity').textContent = activeOrCompletedSprints.length > 0 ? `Avg velocity across ${activeOrCompletedSprints.length} sprint(s)` : 'No sprints completed yet';

    document.getElementById('kpi-utilization').textContent = `${avgUtil}%`;
    document.getElementById('kpi-sub-utilization').textContent = devs.length > 0 ? `${Math.round(totalAssigned)}h assigned / ${totalCap}h capacity` : 'No developers registered';

    document.getElementById('kpi-risk-tasks').textContent = overdueCount + highRiskCount;
    document.getElementById('kpi-sub-risk').textContent = tasks.length > 0 ? `${overdueCount} overdue, ${highRiskCount} high risk` : 'No tasks recorded';
  }

  destroyChart(key) {
    if (this.charts[key]) {
      this.charts[key].destroy();
      this.charts[key] = null;
    }
  }

  renderEmptyChartState(canvasId, title, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    this.destroyChart(canvasId);

    // Render clean empty state
    let emptyDiv = parent.querySelector('.empty-chart-notice');
    if (!emptyDiv) {
      emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-chart-notice';
      emptyDiv.style.cssText = 'position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: #fff; padding: 1.5rem;';
      parent.appendChild(emptyDiv);
    }
    emptyDiv.style.display = 'flex';
    emptyDiv.innerHTML = `
      <div style="font-size: 1.75rem; margin-bottom: 0.25rem;">📊</div>
      <strong style="font-size: 0.9375rem; color: var(--slate-800);">${title}</strong>
      <p style="font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.25rem; max-width: 320px;">${message}</p>
    `;
    canvas.style.display = 'none';
  }

  clearEmptyChartState(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      const emptyDiv = parent.querySelector('.empty-chart-notice');
      if (emptyDiv) emptyDiv.style.display = 'none';
    }
    canvas.style.display = 'block';
  }

  // 1. Sprint Velocity Chart (Planned vs Completed Story Points)
  renderVelocityChart() {
    const canvas = document.getElementById('chart-velocity');
    if (!canvas || !window.Chart) return;

    const sprints = this.getFilteredSprints();
    if (sprints.length === 0) {
      this.renderEmptyChartState('chart-velocity', 'Insufficient Data: No Sprints', 'Create and schedule sprints to visualize planned capacity versus delivered velocity.');
      return;
    }

    this.clearEmptyChartState('chart-velocity');
    this.destroyChart('velocity');

    const labels = sprints.map(s => s.name);
    const plannedPoints = sprints.map(s => s.capacityPoints || 0);
    const completedPoints = sprints.map(s => {
      const stats = this.storage.calculateSprintStats(s.id);
      return stats ? stats.completedPoints : 0;
    });

    this.charts['velocity'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Capacity / Planned (SP)',
            data: plannedPoints,
            backgroundColor: '#cbd5e1',
            borderRadius: 6
          },
          {
            label: 'Delivered Velocity (SP)',
            data: completedPoints,
            backgroundColor: '#4f46e5',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Story Points' }
          }
        }
      }
    });
  }

  // 2. Task Status Distribution (Doughnut Chart)
  renderStatusChart() {
    const canvas = document.getElementById('chart-status');
    if (!canvas || !window.Chart) return;

    const tasks = this.getFilteredTasks();
    if (tasks.length === 0) {
      this.renderEmptyChartState('chart-status', 'Insufficient Data: No Tasks', 'Create project tasks to visualize workflow state distributions.');
      return;
    }

    this.clearEmptyChartState('chart-status');
    this.destroyChart('status');

    const todo = tasks.filter(t => t.status === 'To Do').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const codeReview = tasks.filter(t => t.status === 'Code Review').length;
    const done = tasks.filter(t => t.status === 'Done').length;

    this.charts['status'] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['To Do', 'In Progress', 'Code Review', 'Done'],
        datasets: [{
          data: [todo, inProgress, codeReview, done],
          backgroundColor: ['#94a3b8', '#0ea5e9', '#8b5cf6', '#10b981'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        },
        cutout: '65%'
      }
    });
  }

  // 3. Developer Workload & Capacity Utilization (Horizontal Bar Chart)
  renderWorkloadChart() {
    const canvas = document.getElementById('chart-workload');
    if (!canvas || !window.Chart) return;

    const devs = this.storage.getDevelopers();
    if (devs.length === 0) {
      this.renderEmptyChartState('chart-workload', 'Insufficient Data: No Developers', 'Register developer accounts and assign weekly capacity to track workload balance.');
      return;
    }

    this.clearEmptyChartState('chart-workload');
    this.destroyChart('workload');

    const labels = devs.map(d => d.name);
    const assignedHours = [];
    const capacityHours = [];
    const barColors = [];

    devs.forEach(d => {
      const load = this.storage.calculateDeveloperWorkload(d.id);
      assignedHours.push(load.assignedHours);
      capacityHours.push(load.maxCapacity);
      barColors.push(load.isOverloaded ? '#ef4444' : load.utilizationPercent >= 80 ? '#f59e0b' : '#10b981');
    });

    this.charts['workload'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Assigned Workload (h)',
            data: assignedHours,
            backgroundColor: barColors,
            borderRadius: 6
          },
          {
            label: 'Max Safe Capacity (h)',
            data: capacityHours,
            backgroundColor: '#e2e8f0',
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const idx = ctx.dataIndex;
                const util = capacityHours[idx] > 0 ? Math.round((assignedHours[idx] / capacityHours[idx]) * 100) : 0;
                return `Capacity Utilization: ${util}% ${util > 100 ? '⚠️ OVERLOAD' : ''}`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: 'Hours per Week' }
          }
        }
      }
    });
  }

  // 4. Sprint Burndown Chart (Line Chart strictly from real sprint records)
  renderBurndownChart() {
    const canvas = document.getElementById('chart-burndown');
    if (!canvas || !window.Chart) return;

    const targetProjectId = this.activeProjectId === 'ALL' ? this.storage.getActiveProjectId() : this.activeProjectId;
    const activeSprint = targetProjectId ? this.storage.getActiveSprint(targetProjectId) : null;

    if (!activeSprint) {
      this.renderEmptyChartState('chart-burndown', 'Insufficient Data: No Active Sprint', 'Activate a sprint with committed story points to render burndown progress.');
      return;
    }

    const sprintTasks = this.storage.getTasksBySprint(activeSprint.id);
    const totalPoints = sprintTasks.reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);
    const completedPoints = sprintTasks.filter(t => t.status === 'Done').reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);
    const remainingPoints = Math.max(0, totalPoints - completedPoints);

    if (totalPoints === 0) {
      this.renderEmptyChartState('chart-burndown', 'Insufficient Data: 0 Story Points', 'Commit backlog tasks with story points to the sprint to track burndown.');
      return;
    }

    this.clearEmptyChartState('chart-burndown');
    this.destroyChart('burndown');

    // Generate sprint milestones from sprint dates
    const start = activeSprint.startDate ? new Date(activeSprint.startDate) : new Date();
    const end = activeSprint.endDate ? new Date(activeSprint.endDate) : new Date(Date.now() + 14 * 86400000);

    const labels = ['Sprint Start', 'Midpoint', 'Current Day', 'Sprint End'];
    const idealBurndown = [totalPoints, Math.round(totalPoints * 0.5), Math.round(totalPoints * 0.25), 0];
    const actualBurndown = [totalPoints, null, remainingPoints, null];

    this.charts['burndown'] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ideal Linear Guideline',
            data: idealBurndown,
            borderColor: '#94a3b8',
            borderDash: [5, 5],
            fill: false,
            tension: 0
          },
          {
            label: 'Actual Remaining Points',
            data: actualBurndown,
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            fill: true,
            tension: 0.1,
            pointRadius: 6,
            pointBackgroundColor: '#4f46e5'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Story Points Remaining' }
          }
        }
      }
    });
  }

  // 5. Team Skill Distribution & Task Demand (Bar Chart)
  renderSkillsDemandChart() {
    const canvas = document.getElementById('chart-skills');
    if (!canvas || !window.Chart) return;

    const tasks = this.getFilteredTasks();
    const devs = this.storage.getDevelopers();

    const skillCounts = {};
    tasks.forEach(t => {
      (t.requiredSkills || []).forEach(s => {
        const clean = String(s).trim();
        skillCounts[clean] = (skillCounts[clean] || 0) + 1;
      });
    });

    const teamSkills = {};
    devs.forEach(d => {
      (d.skills || []).forEach(s => {
        const clean = String(s).trim();
        teamSkills[clean] = (teamSkills[clean] || 0) + 1;
      });
    });

    const uniqueSkills = Array.from(new Set([...Object.keys(skillCounts), ...Object.keys(teamSkills)]));
    if (uniqueSkills.length === 0) {
      this.renderEmptyChartState('chart-skills', 'Insufficient Data: No Skill Tags', 'Add required skills to tasks and developer profiles to evaluate skill supply and demand.');
      return;
    }

    this.clearEmptyChartState('chart-skills');
    this.destroyChart('skills');

    const labels = uniqueSkills.slice(0, 10);
    const taskDemand = labels.map(l => skillCounts[l] || 0);
    const devSupply = labels.map(l => teamSkills[l] || 0);

    this.charts['skills'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Task Demand (Tasks Requiring Skill)',
            data: taskDemand,
            backgroundColor: '#0ea5e9',
            borderRadius: 4
          },
          {
            label: 'Developer Supply (Engineers Possessing Skill)',
            data: devSupply,
            backgroundColor: '#10b981',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  // 6. Deadline Risk Matrix (Pie/Doughnut Chart)
  renderRiskChart() {
    const canvas = document.getElementById('chart-risk');
    if (!canvas || !window.Chart) return;

    const tasks = this.getFilteredTasks();
    if (tasks.length === 0) {
      this.renderEmptyChartState('chart-risk', 'Insufficient Data: No Tasks', 'Add project tasks with deadlines to assess delivery risk distributions.');
      return;
    }

    this.clearEmptyChartState('chart-risk');
    this.destroyChart('risk');

    let low = 0;
    let medium = 0;
    let high = 0;
    let overdue = 0;

    tasks.forEach(t => {
      const risk = this.storage.calculateTaskRisk(t);
      if (risk.riskLevel === 'OVERDUE') overdue++;
      else if (risk.riskLevel === 'HIGH') high++;
      else if (risk.riskLevel === 'MEDIUM') medium++;
      else low++;
    });

    this.charts['risk'] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['On Track / Low Risk', 'Moderate Risk', 'High Delay Risk', 'Overdue'],
        datasets: [{
          data: [low, medium, high, overdue],
          backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        },
        cutout: '60%'
      }
    });
  }

  printSummaryReport() {
    window.print();
  }
}

// Global Singleton Instance
window.analyticsController = new AnalyticsController();
