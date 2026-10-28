/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Storage Module - LocalStorage Engine with ZERO Pre-loaded / Fabricated Business Data
 *
 * Mandatory Policy: All business data (users, projects, sprints, tasks, effort, metrics)
 * must be explicitly entered or authorized by the user. No sample data is generated.
 */

const STORAGE_KEY = 'sprint_alloc_system_v2';

const EMPTY_DATA = {
  users: [],
  projects: [],
  sprints: [],
  tasks: [],
  session: {
    userId: null,
    activeProjectId: null
  }
};

class StorageManager {
  constructor() {
    this.init();
  }

  init() {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (!existing) {
        // Initialize 100% empty state - NO mock, dummy, or sample records
        this.saveState(EMPTY_DATA);
      }
    } catch (e) {
      console.error('LocalStorage initialization error:', e);
    }
  }

  getState() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : JSON.parse(JSON.stringify(EMPTY_DATA));
    } catch (e) {
      console.error('Error reading from LocalStorage:', e);
      return JSON.parse(JSON.stringify(EMPTY_DATA));
    }
  }

  saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('appDataChanged', { detail: { state } }));
      return true;
    } catch (e) {
      console.error('Error saving state to LocalStorage:', e);
      return false;
    }
  }

  _generateId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  }

  // Clear all data to empty state
  clearAllData() {
    const empty = JSON.parse(JSON.stringify(EMPTY_DATA));
    this.saveState(empty);
    return empty;
  }

  exportDataJSON() {
    return JSON.stringify(this.getState(), null, 2);
  }

  importDataJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.users) && Array.isArray(parsed.projects) && Array.isArray(parsed.sprints) && Array.isArray(parsed.tasks)) {
        this.saveState(parsed);
        return { success: true };
      }
      return { success: false, error: 'Invalid schema: Expected users, projects, sprints, and tasks arrays.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // --- Session & Current User State ---
  getSession() {
    return this.getState().session || { userId: null, activeProjectId: null };
  }

  setCurrentUser(userId) {
    const state = this.getState();
    const user = state.users.find(u => u.id === userId);
    if (!user && userId !== null) return false;

    state.session.userId = userId;
    // Align active project if user has specific assigned projects
    if (user && user.assignedProjects && user.assignedProjects.length > 0) {
      if (!user.assignedProjects.includes(state.session.activeProjectId)) {
        state.session.activeProjectId = user.assignedProjects[0];
      }
    }
    this.saveState(state);
    return true;
  }

  getCurrentUser() {
    const state = this.getState();
    const session = state.session || {};
    if (!session.userId) return null;
    return state.users.find(u => u.id === session.userId) || null;
  }

  setActiveProject(projectId) {
    const state = this.getState();
    state.session.activeProjectId = projectId;
    this.saveState(state);
  }

  getActiveProjectId() {
    const session = this.getSession();
    if (session.activeProjectId) return session.activeProjectId;
    const projects = this.getProjects();
    return projects.length > 0 ? projects[0].id : null;
  }

  getActiveProject() {
    const id = this.getActiveProjectId();
    return id ? this.getProjectById(id) : null;
  }

  // --- First Administrator Registration ---
  registerFirstAdmin(nameOrObj, email, title = 'System Administrator', skills = [], maxCapacity = 40) {
    let name = nameOrObj;
    if (nameOrObj && typeof nameOrObj === 'object') {
      name = nameOrObj.name;
      email = nameOrObj.email;
      title = nameOrObj.title || 'System Administrator';
      skills = nameOrObj.skills || [];
      maxCapacity = nameOrObj.maxCapacity || nameOrObj.maxWeeklyHours || 40;
    }
    const state = this.getState();
    if (state.users.some(u => u.role === 'admin')) {
      return { success: false, error: 'An administrator account is already configured.' };
    }

    const safeName = (name || 'Admin User').trim();
    const initials = safeName.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() || 'AD';
    const adminUser = {
      id: this._generateId('USR'),
      name: safeName,
      email: (email || 'admin@local').trim().toLowerCase(),
      role: 'admin',
      avatar: initials,
      title: title.trim(),
      experienceLevel: 'Senior',
      skills: Array.isArray(skills) ? skills : [],
      maxWeeklyHours: parseInt(maxCapacity) || 40,
      assignedProjects: [],
      createdAt: new Date().toISOString()
    };

    state.users.push(adminUser);
    state.session.userId = adminUser.id;
    this.saveState(state);
    return { success: true, user: adminUser };
  }

  // --- Users CRUD ---
  getUsers() {
    return this.getState().users || [];
  }

  getUserById(id) {
    if (!id) return null;
    return this.getUsers().find(u => u.id === id) || null;
  }

  getDevelopers() {
    return this.getUsers().filter(u => u.role === 'developer');
  }

  getManagers() {
    return this.getUsers().filter(u => u.role === 'manager');
  }

  saveUser(userData) {
    const state = this.getState();
    if (!userData.name || !userData.email) return null;

    const initials = userData.name.trim().split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() || 'U';

    if (!userData.id) {
      userData.id = this._generateId('USR');
      userData.createdAt = new Date().toISOString();
    }

    userData.avatar = userData.avatar || initials;
    userData.skills = Array.isArray(userData.skills) ? userData.skills : [];
    userData.maxWeeklyHours = parseInt(userData.maxWeeklyHours) || 40;
    userData.assignedProjects = Array.isArray(userData.assignedProjects) ? userData.assignedProjects : [];

    const idx = state.users.findIndex(u => u.id === userData.id);
    if (idx >= 0) {
      state.users[idx] = { ...state.users[idx], ...userData };
    } else {
      state.users.push(userData);
    }

    this.saveState(state);
    return userData;
  }

  deleteUser(userId) {
    const state = this.getState();
    state.users = state.users.filter(u => u.id !== userId);
    // Unassign tasks assigned to deleted user
    state.tasks.forEach(t => {
      if (t.assigneeId === userId) t.assigneeId = null;
    });
    // Remove from projects
    state.projects.forEach(p => {
      if (p.managerId === userId) p.managerId = null;
      if (p.teamMemberIds) {
        p.teamMemberIds = p.teamMemberIds.filter(id => id !== userId);
      }
    });
    if (state.session.userId === userId) {
      state.session.userId = state.users[0]?.id || null;
    }
    this.saveState(state);
    return true;
  }

  // --- Projects CRUD ---
  getProjects() {
    return this.getState().projects || [];
  }

  getProjectById(id) {
    if (!id) return null;
    return this.getProjects().find(p => p.id === id) || null;
  }

  saveProject(project) {
    const state = this.getState();
    if (!project.id || !project.name) return null;

    const existingIdx = state.projects.findIndex(p => p.id === project.id);
    project.teamMemberIds = Array.isArray(project.teamMemberIds) ? project.teamMemberIds : [];
    project.status = project.status || 'Active';

    if (existingIdx >= 0) {
      state.projects[existingIdx] = { ...state.projects[existingIdx], ...project, updatedAt: new Date().toISOString() };
    } else {
      project.createdAt = new Date().toISOString();
      state.projects.push(project);
    }

    // Ensure users have this project in assignedProjects
    if (project.managerId) {
      const pm = state.users.find(u => u.id === project.managerId);
      if (pm && !pm.assignedProjects.includes(project.id)) {
        pm.assignedProjects.push(project.id);
      }
    }
    project.teamMemberIds.forEach(devId => {
      const dev = state.users.find(u => u.id === devId);
      if (dev && !dev.assignedProjects.includes(project.id)) {
        dev.assignedProjects.push(project.id);
      }
    });

    this.saveState(state);
    return project;
  }

  archiveProject(projectId) {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    project.status = 'Archived';
    return !!this.saveProject(project);
  }

  restoreProject(projectId) {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    project.status = 'Active';
    return !!this.saveProject(project);
  }

  deleteProject(projectId) {
    const state = this.getState();
    state.projects = state.projects.filter(p => p.id !== projectId);
    state.sprints = state.sprints.filter(s => s.projectId !== projectId);
    state.tasks = state.tasks.filter(t => t.projectId !== projectId);

    if (state.session.activeProjectId === projectId) {
      state.session.activeProjectId = state.projects[0]?.id || null;
    }
    this.saveState(state);
    return true;
  }

  // --- Sprints CRUD ---
  getSprints() {
    return this.getState().sprints || [];
  }

  getSprintById(id) {
    if (!id) return null;
    return this.getSprints().find(s => s.id === id) || null;
  }

  getSprintsByProject(projectId) {
    if (!projectId) return [];
    return this.getSprints().filter(s => s.projectId === projectId);
  }

  getActiveSprint(projectId) {
    const sprints = this.getSprintsByProject(projectId);
    return sprints.find(s => s.status === 'Active') || sprints[0] || null;
  }

  saveSprint(sprint) {
    const state = this.getState();
    if (!sprint.name || !sprint.projectId) return null;

    if (!sprint.id) {
      sprint.id = this._generateId('SP');
      sprint.createdAt = new Date().toISOString();
    }

    sprint.status = sprint.status || 'Planned';
    sprint.capacityPoints = parseInt(sprint.capacityPoints) || 0;
    sprint.capacityHours = parseInt(sprint.capacityHours) || 0;

    const idx = state.sprints.findIndex(s => s.id === sprint.id);
    if (idx >= 0) {
      state.sprints[idx] = { ...state.sprints[idx], ...sprint };
    } else {
      state.sprints.push(sprint);
    }

    this.saveState(state);
    return sprint;
  }

  deleteSprint(sprintId) {
    const state = this.getState();
    state.sprints = state.sprints.filter(s => s.id !== sprintId);
    state.tasks.forEach(t => {
      if (t.sprintId === sprintId) t.sprintId = null;
    });
    this.saveState(state);
    return true;
  }

  // --- Tasks CRUD ---
  getTasks() {
    return this.getState().tasks || [];
  }

  getTaskById(id) {
    if (!id) return null;
    return this.getTasks().find(t => t.id === id) || null;
  }

  getTasksByProject(projectId) {
    if (!projectId) return [];
    return this.getTasks().filter(t => t.projectId === projectId);
  }

  getTasksBySprint(sprintId) {
    if (!sprintId) return [];
    return this.getTasks().filter(t => t.sprintId === sprintId);
  }

  getTasksByAssignee(assigneeId) {
    if (!assigneeId) return [];
    return this.getTasks().filter(t => t.assigneeId === assigneeId);
  }

  saveTask(task) {
    const state = this.getState();
    if (!task.title || !task.projectId) return null;

    const now = new Date().toISOString();
    if (!task.id) {
      task.id = this._generateId('TSK');
      task.createdAt = now;
      task.workLogs = [];
      task.actualHours = 0;
      task.blockers = [];
      task.progressNotes = [];
    }

    task.updatedAt = now;
    task.requiredSkills = Array.isArray(task.requiredSkills) ? task.requiredSkills : [];
    task.storyPoints = parseInt(task.storyPoints) || 0;
    task.estimatedHours = parseFloat(task.estimatedHours) || 0;
    task.actualHours = parseFloat(task.actualHours) || 0;
    task.workLogs = Array.isArray(task.workLogs) ? task.workLogs : [];
    task.blockers = Array.isArray(task.blockers) ? task.blockers : [];
    task.progressNotes = Array.isArray(task.progressNotes) ? task.progressNotes : [];
    task.dependencies = Array.isArray(task.dependencies) ? task.dependencies : [];
    task.status = task.status || 'To Do';
    task.priority = task.priority || 'Medium';

    const idx = state.tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      state.tasks[idx] = { ...state.tasks[idx], ...task };
    } else {
      state.tasks.push(task);
    }

    this.saveState(state);
    return task;
  }

  deleteTask(taskId) {
    const state = this.getState();
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    this.saveState(state);
    return true;
  }

  logEffort(taskId, hours, note = '', workDate = null) {
    const task = this.getTaskById(taskId);
    if (!task) return null;

    const session = this.getSession();
    const logHours = parseFloat(hours);
    if (isNaN(logHours) || logHours <= 0) return null;

    const logEntry = {
      id: this._generateId('WL'),
      date: workDate || new Date().toISOString().split('T')[0],
      hours: logHours,
      note: note.trim() || 'Work effort recorded',
      loggedBy: session.userId || null,
      timestamp: new Date().toISOString()
    };

    task.workLogs = task.workLogs || [];
    task.workLogs.push(logEntry);
    task.actualHours = Math.round(((parseFloat(task.actualHours) || 0) + logHours) * 10) / 10;
    task.updatedAt = new Date().toISOString();

    this.saveTask(task);
    return task;
  }

  addBlockerOrNote(taskId, text, isBlocker = false) {
    const task = this.getTaskById(taskId);
    if (!task || !text.trim()) return null;

    const entry = {
      id: this._generateId('NTE'),
      text: text.trim(),
      authorId: this.getSession().userId,
      timestamp: new Date().toISOString()
    };

    if (isBlocker) {
      task.blockers = task.blockers || [];
      task.blockers.push(entry);
    } else {
      task.progressNotes = task.progressNotes || [];
      task.progressNotes.push(entry);
    }

    this.saveTask(task);
    return task;
  }

  // ==========================================
  // TRANSPARENT RULE-BASED CALCULATION ENGINES
  // (Exclusively operates on real entered inputs)
  // ==========================================

  /**
   * Rule 1: Skill Compatibility Evaluation
   */
  calculateSkillMatch(taskRequiredSkills = [], devSkills = []) {
    if (!taskRequiredSkills || taskRequiredSkills.length === 0) {
      return {
        matchPercent: 100,
        matchedCount: 0,
        totalRequired: 0,
        matchedSkills: [],
        missingSkills: [],
        scorePoints: 50,
        hasRequirements: false
      };
    }

    if (!devSkills || devSkills.length === 0) {
      return {
        matchPercent: 0,
        matchedCount: 0,
        totalRequired: taskRequiredSkills.length,
        matchedSkills: [],
        missingSkills: taskRequiredSkills,
        scorePoints: 0,
        hasRequirements: true
      };
    }

    const devSkillsNormalized = devSkills.map(s => String(s).toLowerCase().trim());
    const matched = [];
    const missing = [];

    taskRequiredSkills.forEach(req => {
      const cleanReq = String(req).trim();
      if (devSkillsNormalized.includes(cleanReq.toLowerCase())) {
        matched.push(cleanReq);
      } else {
        missing.push(cleanReq);
      }
    });

    const ratio = matched.length / taskRequiredSkills.length;
    return {
      matchPercent: Math.round(ratio * 100),
      matchedCount: matched.length,
      totalRequired: taskRequiredSkills.length,
      matchedSkills: matched,
      missingSkills: missing,
      scorePoints: Math.round(ratio * 50),
      hasRequirements: true
    };
  }

  /**
   * Rule 2: Developer Workload & Capacity Evaluation
   */
  calculateDeveloperWorkload(developerId, sprintId = null) {
    const dev = this.getUserById(developerId);
    if (!dev) return null;

    let tasks = [];
    if (sprintId) {
      tasks = this.getTasksBySprint(sprintId).filter(t => t.assigneeId === developerId && t.status !== 'Done');
    } else {
      tasks = this.getTasksByAssignee(developerId).filter(t => t.status !== 'Done');
    }

    const assignedHours = tasks.reduce((sum, t) => {
      const est = parseFloat(t.estimatedHours) || 0;
      const act = parseFloat(t.actualHours) || 0;
      return sum + Math.max(0, est - act);
    }, 0);

    const maxCapacity = dev.maxWeeklyHours || 40;
    const utilizationPercent = maxCapacity > 0 ? Math.round((assignedHours / maxCapacity) * 100) : 0;
    const isOverloaded = assignedHours > maxCapacity;
    const excessHours = isOverloaded ? Math.round((assignedHours - maxCapacity) * 10) / 10 : 0;

    return {
      developerId,
      developerName: dev.name,
      assignedHours: Math.round(assignedHours * 10) / 10,
      taskCount: tasks.length,
      maxCapacity,
      utilizationPercent,
      isOverloaded,
      excessHours
    };
  }

  /**
   * Rule 3: Transparent Developer Recommendation Engine
   * Evaluates registered team members based on verified inputs:
   * - Skill Compatibility (0 - 50 pts)
   * - Remaining Capacity / Availability (0 - 30 pts; 0 if overloaded)
   * - Experience Level (0 - 20 pts)
   */
  recommendDevelopersForTask(task, sprintId = null) {
    const allDevs = this.getDevelopers();
    if (allDevs.length === 0) {
      return {
        recommendations: [],
        hasData: false,
        message: 'No registered developers available in system. Add developers to generate recommendations.'
      };
    }

    const taskEstHours = parseFloat(task.estimatedHours) || 0;
    const targetSprintId = sprintId || task.sprintId;

    const list = allDevs.map(dev => {
      // 1. Skill evaluation
      const skillEval = this.calculateSkillMatch(task.requiredSkills, dev.skills);

      // 2. Workload & Availability evaluation
      const workload = this.calculateDeveloperWorkload(dev.id, targetSprintId);
      const currentAssigned = workload ? workload.assignedHours : 0;
      const projectedLoad = currentAssigned + taskEstHours;
      const capacity = dev.maxWeeklyHours || 40;
      const willExceed = capacity > 0 && projectedLoad > capacity;

      let workloadScore = 0;
      if (willExceed) {
        workloadScore = 0; // Overload penalty
      } else if (capacity > 0) {
        const availableRatio = Math.max(0, 1 - (projectedLoad / capacity));
        workloadScore = Math.round(availableRatio * 30);
      }

      // 3. Experience level weighting
      let experienceScore = 15;
      if (dev.experienceLevel === 'Senior') experienceScore = 20;
      else if (dev.experienceLevel === 'Mid') experienceScore = 15;
      else if (dev.experienceLevel === 'Junior') experienceScore = 10;

      const totalScore = Math.min(100, skillEval.scorePoints + workloadScore + experienceScore);

      let recommendationLabel = 'Not Recommended';
      let matchBadge = 'danger';
      if (willExceed) {
        recommendationLabel = 'Capacity Exceeded';
        matchBadge = 'warning';
      } else if (totalScore >= 80) {
        recommendationLabel = 'Strong Fit';
        matchBadge = 'high';
      } else if (totalScore >= 60) {
        recommendationLabel = 'Moderate Fit';
        matchBadge = 'medium';
      } else if (totalScore >= 40) {
        recommendationLabel = 'Partial Fit';
        matchBadge = 'low';
      }

      return {
        developer: dev,
        totalScore,
        recommendationLabel,
        matchBadge,
        breakdown: {
          skillScore: skillEval.scorePoints,
          maxSkillScore: 50,
          skillPercent: skillEval.matchPercent,
          matchedSkills: skillEval.matchedSkills,
          missingSkills: skillEval.missingSkills,
          hasSkillRequirements: skillEval.hasRequirements,
          workloadScore,
          maxWorkloadScore: 30,
          currentLoadHours: currentAssigned,
          capacityHours: capacity,
          projectedLoadHours: Math.round(projectedLoad * 10) / 10,
          willExceedCapacity: willExceed,
          excessHours: willExceed ? Math.round((projectedLoad - capacity) * 10) / 10 : 0,
          experienceScore,
          maxExperienceScore: 20,
          experienceLevel: dev.experienceLevel
        }
      };
    });

    list.sort((a, b) => b.totalScore - a.totalScore);
    return {
      recommendations: list,
      hasData: true,
      message: 'Rule-based matching calculation based on entered skills, recorded load, and registered capacity.'
    };
  }

  /**
   * Rule 4: Deadline Risk Assessment
   * Compares remaining effort hours with business days remaining before deadline.
   */
  calculateTaskRisk(task) {
    if (!task) {
      return { riskLevel: 'NONE', badgeClass: 'badge-todo', label: 'Insufficient Data', reason: 'No task details available.' };
    }

    if (task.status === 'Done') {
      return {
        riskLevel: 'COMPLETED',
        badgeClass: 'badge-done',
        label: 'Completed',
        reason: 'Task is marked Done.',
        daysRemaining: 0,
        remainingHours: 0
      };
    }

    if (!task.deadline) {
      return {
        riskLevel: 'NO_DEADLINE',
        badgeClass: 'badge-todo',
        label: 'No Deadline',
        reason: 'No deadline entered by user.',
        daysRemaining: null,
        remainingHours: Math.max(0, (parseFloat(task.estimatedHours) || 0) - (parseFloat(task.actualHours) || 0))
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadlineDate = new Date(task.deadline);
    deadlineDate.setHours(23, 59, 59, 999);

    if (isNaN(deadlineDate.getTime())) {
      return { riskLevel: 'INVALID', badgeClass: 'badge-todo', label: 'Invalid Date', reason: 'Due date format invalid.' };
    }

    const est = parseFloat(task.estimatedHours) || 0;
    const act = parseFloat(task.actualHours) || 0;
    const remainingHours = Math.max(0, est - act);

    const diffMs = deadlineDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      const daysOverdue = Math.abs(daysRemaining);
      return {
        riskLevel: 'OVERDUE',
        badgeClass: 'badge-risk-overdue',
        label: 'Overdue',
        daysRemaining,
        remainingHours,
        reason: `Deadline passed ${daysOverdue} day(s) ago on ${task.deadline}. Requires immediate review.`
      };
    }

    const effectiveDays = Math.max(0.5, daysRemaining);
    const availableWorkingHours = effectiveDays * 6; // Assume 6 productive working hours per day

    if (remainingHours > availableWorkingHours) {
      return {
        riskLevel: 'HIGH',
        badgeClass: 'badge-risk-high',
        label: 'High Delay Risk',
        daysRemaining,
        remainingHours,
        reason: `Remaining effort (${remainingHours}h) exceeds estimated working hours (${Math.round(availableWorkingHours)}h) before ${task.deadline}.`
      };
    }

    if (remainingHours > availableWorkingHours * 0.7) {
      return {
        riskLevel: 'MEDIUM',
        badgeClass: 'badge-risk-medium',
        label: 'Moderate Risk',
        daysRemaining,
        remainingHours,
        reason: `Tight schedule: ${remainingHours}h remaining with minimal buffer (${Math.round(availableWorkingHours)}h capacity).`
      };
    }

    return {
      riskLevel: 'LOW',
      badgeClass: 'badge-risk-low',
      label: 'On Track',
      daysRemaining,
      remainingHours,
      reason: `Schedule healthy: ${remainingHours}h remaining over ${daysRemaining} day(s).`
    };
  }

  /**
   * Project Statistics Aggregator (Strictly real data)
   */
  calculateProjectStats(projectId) {
    const tasks = this.getTasksByProject(projectId);
    const totalTasks = tasks.length;

    if (totalTasks === 0) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        todoTasks: 0,
        totalPoints: 0,
        completedPoints: 0,
        progressPercent: 0,
        overdueCount: 0,
        highRiskCount: 0,
        totalHoursEstimated: 0,
        totalHoursActual: 0,
        hasData: false
      };
    }

    const completedTasks = tasks.filter(t => t.status === 'Done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'In Progress' || t.status === 'Code Review').length;
    const todoTasks = tasks.filter(t => t.status === 'To Do').length;

    const totalPoints = tasks.reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);
    const completedPoints = tasks
      .filter(t => t.status === 'Done')
      .reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);

    const progressPercent = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    let overdueCount = 0;
    let highRiskCount = 0;

    tasks.forEach(t => {
      const risk = this.calculateTaskRisk(t);
      if (risk.riskLevel === 'OVERDUE') overdueCount++;
      else if (risk.riskLevel === 'HIGH') highRiskCount++;
    });

    const totalHoursEstimated = tasks.reduce((sum, t) => sum + (parseFloat(t.estimatedHours) || 0), 0);
    const totalHoursActual = tasks.reduce((sum, t) => sum + (parseFloat(t.actualHours) || 0), 0);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      totalPoints,
      completedPoints,
      progressPercent,
      overdueCount,
      highRiskCount,
      totalHoursEstimated: Math.round(totalHoursEstimated),
      totalHoursActual: Math.round(totalHoursActual),
      hasData: true
    };
  }

  /**
   * Sprint Statistics Aggregator (Strictly real data)
   */
  calculateSprintStats(sprintId) {
    const sprint = this.getSprintById(sprintId);
    if (!sprint) return null;

    const tasks = this.getTasksBySprint(sprintId);
    const totalPoints = tasks.reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);
    const completedPoints = tasks
      .filter(t => t.status === 'Done')
      .reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);

    const totalHours = tasks.reduce((sum, t) => sum + (parseFloat(t.estimatedHours) || 0), 0);
    const loggedHours = tasks.reduce((sum, t) => sum + (parseFloat(t.actualHours) || 0), 0);

    const capacityPoints = parseInt(sprint.capacityPoints) || 0;
    const capacityHours = parseInt(sprint.capacityHours) || 0;

    const pointCapacityPercent = capacityPoints > 0 ? Math.round((totalPoints / capacityPoints) * 100) : 0;
    const hourCapacityPercent = capacityHours > 0 ? Math.round((totalHours / capacityHours) * 100) : 0;

    return {
      sprint,
      taskCount: tasks.length,
      totalPoints,
      completedPoints,
      remainingPoints: Math.max(0, totalPoints - completedPoints),
      totalHours: Math.round(totalHours),
      loggedHours: Math.round(loggedHours),
      capacityPoints,
      capacityHours,
      pointCapacityPercent,
      hourCapacityPercent,
      isCapacityExceeded: (capacityPoints > 0 && totalPoints > capacityPoints) || (capacityHours > 0 && totalHours > capacityHours)
    };
  }
}

// Global Singleton Instance
window.storageManager = new StorageManager();
