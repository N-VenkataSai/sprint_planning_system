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
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('appDataChanged', { detail: { state } }));
      }
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

  // --- Developer Dataset Importer & Validator ---
  _parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const headers = parseLine(lines[0]).map(h => h.trim());
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index] !== undefined ? values[index] : '';
      });
      records.push(record);
    }
    return records;
  }

  /**
   * Import and validate developer records from real datasets.
   * Enforces complete processing: never limits imports to a fixed count.
   * Validates every record, reports line-by-line rejection reasons, and preserves IDs.
   */
  importDevelopersDataset(inputData, targetProjectId = null) {
    let rawRecords = [];

    if (Array.isArray(inputData)) {
      rawRecords = inputData;
    } else if (typeof inputData === 'string') {
      const trimmed = inputData.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          rawRecords = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          return {
            success: false,
            totalProcessed: 0,
            importedCount: 0,
            rejectedCount: 0,
            importedRecords: [],
            rejectedRecords: [],
            error: `JSON parse error: ${e.message}`
          };
        }
      } else {
        rawRecords = this._parseCSV(trimmed);
      }
    }

    if (!rawRecords || rawRecords.length === 0) {
      return {
        success: false,
        totalProcessed: 0,
        importedCount: 0,
        rejectedCount: 0,
        importedRecords: [],
        rejectedRecords: [],
        error: 'No valid data rows found to import.'
      };
    }

    const state = this.getState();
    const existingUsers = state.users || [];
    const existingIds = new Set(existingUsers.map(u => String(u.id).toLowerCase()));
    const existingEmails = new Set(existingUsers.map(u => String(u.email).toLowerCase()));

    const batchIds = new Set();
    const batchEmails = new Set();

    const importedRecords = [];
    const rejectedRecords = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    rawRecords.forEach((raw, idx) => {
      const rowNum = idx + 1;
      const reasons = [];

      const rawName = raw.name || raw.fullName || raw.full_name || raw.developer_name || '';
      const rawEmail = raw.email || raw.developer_email || raw.email_address || '';
      const rawId = raw.id || raw.developer_id || raw.dev_id || '';
      const rawRole = String(raw.role || raw.system_role || 'developer').toLowerCase();
      const rawTitle = raw.title || raw.job_title || raw.position || 'Software Developer';
      const rawExp = raw.experienceLevel || raw.experience_level || raw.seniority || raw.level || 'Mid';
      const rawSkills = raw.skills || raw.skill_tags || raw.technologies || [];
      const rawCapacity = raw.maxWeeklyHours || raw.weekly_capacity || raw.capacity || raw.maxHours || 40;
      const rawProjects = raw.assignedProjects || raw.projects || raw.project_ids || [];

      // Validation 1: Name
      const cleanName = String(rawName).trim();
      if (!cleanName || cleanName.length < 2) {
        reasons.push('Name is required and must be at least 2 characters.');
      }

      // Validation 2: Email
      const cleanEmail = String(rawEmail).trim().toLowerCase();
      if (!cleanEmail) {
        reasons.push('Email address is required.');
      } else if (!emailRegex.test(cleanEmail)) {
        reasons.push(`Invalid email format: "${cleanEmail}".`);
      } else if (existingEmails.has(cleanEmail)) {
        reasons.push(`Email already registered in system: "${cleanEmail}".`);
      } else if (batchEmails.has(cleanEmail)) {
        reasons.push(`Duplicate email within dataset: "${cleanEmail}".`);
      }

      // Validation 3: ID (if provided)
      let cleanId = String(rawId).trim();
      if (cleanId) {
        const lowerId = cleanId.toLowerCase();
        if (existingIds.has(lowerId)) {
          reasons.push(`Developer ID already exists in system: "${cleanId}".`);
        } else if (batchIds.has(lowerId)) {
          reasons.push(`Duplicate Developer ID within dataset: "${cleanId}".`);
        }
      } else {
        cleanId = this._generateId('USR');
      }

      // Validation 4: Capacity
      const numCapacity = parseFloat(rawCapacity);
      if (isNaN(numCapacity) || numCapacity <= 0 || numCapacity > 80) {
        reasons.push(`Invalid weekly capacity: "${rawCapacity}". Must be a number between 1 and 80.`);
      }

      // Validation 5: Role
      const validRoles = ['developer', 'manager', 'admin'];
      const normalizedRole = validRoles.includes(rawRole) ? rawRole : 'developer';

      // Validation 6: Experience Level normalization
      let normalizedExp = 'Mid';
      const expStr = String(rawExp).trim().toLowerCase();
      if (expStr.includes('sr') || expStr.includes('senior') || expStr.includes('lead') || expStr === '3') {
        normalizedExp = 'Senior';
      } else if (expStr.includes('jr') || expStr.includes('junior') || expStr.includes('entry') || expStr === '1') {
        normalizedExp = 'Junior';
      } else {
        normalizedExp = 'Mid';
      }

      // Skills normalization
      let skillsList = [];
      if (Array.isArray(rawSkills)) {
        skillsList = rawSkills.map(s => String(s).trim()).filter(Boolean);
      } else if (typeof rawSkills === 'string') {
        skillsList = rawSkills.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
      }
      skillsList = Array.from(new Set(skillsList));

      // Projects association
      let projectList = [];
      if (Array.isArray(rawProjects)) {
        projectList = rawProjects.map(p => String(p).trim()).filter(Boolean);
      } else if (typeof rawProjects === 'string') {
        projectList = rawProjects.split(/[,;|]/).map(p => p.trim()).filter(Boolean);
      }
      if (targetProjectId && !projectList.includes(targetProjectId)) {
        projectList.push(targetProjectId);
      }

      if (reasons.length > 0) {
        rejectedRecords.push({
          rowNumber: rowNum,
          name: cleanName || 'Unknown',
          email: cleanEmail || 'N/A',
          reasons
        });
      } else {
        batchEmails.add(cleanEmail);
        batchIds.add(cleanId.toLowerCase());

        const initials = cleanName.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() || 'DV';
        const user = {
          id: cleanId,
          name: cleanName,
          email: cleanEmail,
          role: normalizedRole,
          title: String(rawTitle).trim() || 'Software Developer',
          experienceLevel: normalizedExp,
          avatar: initials,
          skills: skillsList,
          maxWeeklyHours: Math.round(numCapacity),
          assignedProjects: projectList,
          createdAt: new Date().toISOString()
        };

        importedRecords.push(user);
        state.users.push(user);

        if (projectList.length > 0) {
          projectList.forEach(prjId => {
            const project = state.projects.find(p => p.id === prjId);
            if (project) {
              project.teamMemberIds = project.teamMemberIds || [];
              if (!project.teamMemberIds.includes(user.id)) {
                project.teamMemberIds.push(user.id);
              }
            }
          });
        }
      }
    });

    if (importedRecords.length > 0) {
      this.saveState(state);
    }

    return {
      success: importedRecords.length > 0,
      totalProcessed: rawRecords.length,
      importedCount: importedRecords.length,
      rejectedCount: rejectedRecords.length,
      importedRecords,
      rejectedRecords
    };
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
   * Rule 3: Intelligent Developer Recommendation Engine (5-Factor Normalized Multi-Criteria)
   *
   * Nominal Weights:
   * 1. Skill Compatibility: 40%
   * 2. Experience Compatibility: 20%
   * 3. Availability: 20%
   * 4. Workload Balance: 15%
   * 5. Historical Performance: 5%
   *
   * Dynamic Normalization:
   * If any criterion is unavailable (e.g. historical performance in a fresh system),
   * value is NOT invented. Weights are dynamically re-normalized among available criteria,
   * and missing data is explicitly disclosed in the recommendation output.
   */
  calculateDeveloperHistoricalPerformance(developerId) {
    const state = this.getState();
    const completedTasks = (state.tasks || []).filter(t => t.assigneeId === developerId && t.status === 'Done');
    if (completedTasks.length === 0) {
      return {
        available: false,
        completedCount: 0,
        onTimeCount: 0,
        onTimeRate: null,
        scorePoints: 0,
        maxScorePoints: 5,
        reason: 'No completed tasks recorded in system history for this developer.'
      };
    }

    let onTimeCount = 0;
    completedTasks.forEach(t => {
      if (!t.deadline) {
        onTimeCount++;
      } else {
        const dDate = new Date(t.deadline);
        const uDate = new Date(t.updatedAt || t.createdAt);
        if (uDate <= dDate) onTimeCount++;
      }
    });

    const onTimeRate = onTimeCount / completedTasks.length;
    const scorePoints = Math.round(onTimeRate * 5 * 10) / 10;
    return {
      available: true,
      completedCount: completedTasks.length,
      onTimeCount,
      onTimeRate: Math.round(onTimeRate * 100),
      scorePoints,
      maxScorePoints: 5,
      reason: `Historical performance: ${completedTasks.length} tasks completed (${Math.round(onTimeRate * 100)}% on-time).`
    };
  }

  recommendDevelopersForTask(task, sprintId = null) {
    const allDevs = this.getDevelopers();
    if (allDevs.length === 0) {
      return {
        recommendations: [],
        topRecommendations: [],
        allRankedCandidates: [],
        hasData: false,
        totalEligible: 0,
        message: 'No registered developers available in system. Add developers to generate recommendations.'
      };
    }

    const taskEstHours = parseFloat(task.estimatedHours) || 8;
    const targetSprintId = sprintId || task.sprintId;
    const taskPriority = (task.priority || 'Medium').toLowerCase();
    const taskPoints = parseInt(task.storyPoints) || 3;

    const list = allDevs.map(dev => {
      const disclosures = [];

      // 1. Skill evaluation (nominal weight 40%)
      const reqSkills = task.requiredSkills || [];
      const devSkillsUpper = (dev.skills || []).map(s => String(s).trim().toUpperCase());
      let matchedSkills = [];
      let missingSkills = [];
      let skillMatchPercent = 100;
      let rawSkillScore = 40; // 0-40

      if (reqSkills.length > 0) {
        matchedSkills = reqSkills.filter(req => devSkillsUpper.includes(String(req).trim().toUpperCase()));
        missingSkills = reqSkills.filter(req => !devSkillsUpper.includes(String(req).trim().toUpperCase()));
        skillMatchPercent = Math.round((matchedSkills.length / reqSkills.length) * 100);
        rawSkillScore = (matchedSkills.length / reqSkills.length) * 40;
      } else {
        disclosures.push('Task has no technical skill prerequisites specified; 100% skill compatibility awarded.');
      }

      // 2. Experience compatibility (nominal weight 20%)
      let rawExpScore = 15;
      let expSuitabilityDesc = '';
      const expLevel = dev.experienceLevel || 'Mid';

      const isHighComplexity = taskPriority === 'critical' || taskPriority === 'high' || taskPoints >= 8 || taskEstHours >= 24;
      const isLowComplexity = taskPriority === 'low' || (taskPoints <= 2 && taskEstHours <= 8);

      if (isHighComplexity) {
        if (expLevel === 'Senior') {
          rawExpScore = 20;
          expSuitabilityDesc = 'High - Senior profile is optimal for complex/critical architectural delivery.';
        } else if (expLevel === 'Mid') {
          rawExpScore = 14;
          expSuitabilityDesc = 'Moderate - Mid-level developer capable; senior review recommended for critical paths.';
        } else {
          rawExpScore = 8;
          expSuitabilityDesc = 'Low - Junior profile carries elevated risk for critical/high-complexity tasks.';
        }
      } else if (isLowComplexity) {
        if (expLevel === 'Junior') {
          rawExpScore = 20;
          expSuitabilityDesc = 'High - Junior profile is optimal for focused, well-defined tasks.';
        } else if (expLevel === 'Mid') {
          rawExpScore = 18;
          expSuitabilityDesc = 'High - Mid-level developer will execute quickly with high reliability.';
        } else {
          rawExpScore = 15;
          expSuitabilityDesc = 'Moderate - Senior developer is overqualified; resource efficiency could be optimized.';
        }
      } else {
        // Medium complexity (default)
        if (expLevel === 'Mid') {
          rawExpScore = 20;
          expSuitabilityDesc = 'Optimal - Mid-level developer matches standard sprint story scope.';
        } else if (expLevel === 'Senior') {
          rawExpScore = 19;
          expSuitabilityDesc = 'High - Senior developer brings high competency with minimal risk.';
        } else {
          rawExpScore = 13;
          expSuitabilityDesc = 'Moderate - Junior developer can complete task with standard peer review.';
        }
      }

      if (dev.yearsExperience !== undefined && dev.yearsExperience !== null) {
        disclosures.push(`Experience verified with ${dev.yearsExperience} recorded year(s) of professional experience.`);
      }

      // 3. Availability (nominal weight 20%)
      const workload = this.calculateDeveloperWorkload(dev.id, targetSprintId);
      const currentAssigned = workload ? workload.assignedHours : 0;
      const capacity = dev.maxWeeklyHours || 40;
      const remainingHours = Math.max(0, capacity - currentAssigned);
      const projectedLoad = currentAssigned + taskEstHours;
      const willExceed = capacity > 0 && projectedLoad > capacity;
      const excessHours = willExceed ? Math.round((projectedLoad - capacity) * 10) / 10 : 0;

      let rawAvailScore = 0;
      if (willExceed) {
        rawAvailScore = 0; // Exceeded capacity
      } else if (capacity > 0) {
        const bufferRatio = Math.max(0, (capacity - projectedLoad) / capacity);
        rawAvailScore = Math.round((0.5 + 0.5 * bufferRatio) * 20 * 10) / 10;
      }

      // 4. Workload balance (nominal weight 15%)
      let rawWorkloadScore = 0;
      const utilization = capacity > 0 ? (currentAssigned / capacity) : 0;
      if (currentAssigned === 0) {
        rawWorkloadScore = 15; // 0 current load: highest balancing priority
      } else if (utilization <= 0.4) {
        rawWorkloadScore = 13;
      } else if (utilization <= 0.7) {
        rawWorkloadScore = 10;
      } else if (utilization <= 0.9) {
        rawWorkloadScore = 6;
      } else if (utilization <= 1.0) {
        rawWorkloadScore = 3;
      } else {
        rawWorkloadScore = 0; // Overloaded
      }

      // 5. Historical performance (nominal weight 5%)
      const hist = this.calculateDeveloperHistoricalPerformance(dev.id);
      let rawHistScore = 0;
      const isHistAvailable = hist.available;

      if (isHistAvailable) {
        rawHistScore = hist.scorePoints;
      } else {
        disclosures.push('Historical completion performance unrecorded in records; 5% weight dynamically redistributed across other 4 criteria.');
      }

      // Dynamic Re-normalization calculation
      let nominalTotalAvailable = 40 + 20 + 20 + 15; // 95
      if (isHistAvailable) nominalTotalAvailable += 5; // 100

      const multiplier = 100 / nominalTotalAvailable;
      const weightsApplied = {
        skills: Math.round((40 * multiplier) * 10) / 10,
        experience: Math.round((20 * multiplier) * 10) / 10,
        availability: Math.round((20 * multiplier) * 10) / 10,
        workload: Math.round((15 * multiplier) * 10) / 10,
        historicalPerformance: isHistAvailable ? Math.round((5 * multiplier) * 10) / 10 : 0
      };

      const rawSum = rawSkillScore + rawExpScore + rawAvailScore + rawWorkloadScore + (isHistAvailable ? rawHistScore : 0);
      const totalScore = Math.min(100, Math.max(0, Math.round(rawSum * multiplier)));

      // Recommendation label & badge
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

      // Recommendation reasons
      const recommendationReasons = [];
      if (skillMatchPercent === 100 && reqSkills.length > 0) {
        recommendationReasons.push(`Complete skill compatibility (100% match: ${matchedSkills.join(', ')})`);
      } else if (skillMatchPercent > 0) {
        recommendationReasons.push(`${skillMatchPercent}% skill match (${matchedSkills.length}/${reqSkills.length} required skills)`);
      }
      recommendationReasons.push(expSuitabilityDesc);
      if (!willExceed && remainingHours >= taskEstHours) {
        recommendationReasons.push(`Sufficient capacity buffer (${remainingHours}h available vs ${taskEstHours}h required)`);
      }
      if (currentAssigned === 0) {
        recommendationReasons.push('Developer currently has zero assigned tasks; prioritizes workload balance.');
      }

      // Potential assignment risks
      const potentialRisks = [];
      if (willExceed) {
        potentialRisks.push(`Capacity Overload: Assigning this task exceeds safe weekly limit by ${excessHours}h (${projectedLoad}h / ${capacity}h)`);
      } else if (projectedLoad / capacity >= 0.85) {
        potentialRisks.push(`High Utilization: Workload will reach ${Math.round((projectedLoad / capacity) * 100)}% of weekly limit`);
      }
      if (missingSkills.length > 0) {
        potentialRisks.push(`Skill Gap: Lacks verified proficiency in: ${missingSkills.join(', ')}`);
      }
      if (isHighComplexity && expLevel === 'Junior') {
        potentialRisks.push('Experience Mismatch: Junior profile assigned to critical/high-complexity task');
      }

      return {
        developer: dev,
        developerId: dev.id,
        developerName: dev.name,
        jobTitle: dev.title,
        experienceLevel: expLevel,
        totalScore,
        overallMatchScore: totalScore,
        skillMatchPercent,
        matchedSkills,
        missingSkills,
        experienceSuitability: expSuitabilityDesc,
        availableWorkingHours: remainingHours,
        currentWorkloadHours: currentAssigned,
        maxWeeklyHours: capacity,
        willExceedCapacity: willExceed,
        excessHours,
        recommendationLabel,
        matchBadge,
        recommendationReasons,
        potentialRisks,
        notRecommendedReasons: [],
        weightsApplied,
        disclosures,
        breakdown: {
          // New 5-factor normalized fields
          skillCompatibilityScore: Math.round(rawSkillScore * multiplier * 10) / 10,
          experienceSuitabilityScore: Math.round(rawExpScore * multiplier * 10) / 10,
          availabilityScore: Math.round(rawAvailScore * multiplier * 10) / 10,
          workloadBalanceScore: Math.round(rawWorkloadScore * multiplier * 10) / 10,
          historicalPerformanceScore: isHistAvailable ? Math.round(rawHistScore * multiplier * 10) / 10 : 0,

          // Backward-compatible fields for test-suite & existing views
          skillScore: Math.round((skillMatchPercent / 100) * 50),
          maxSkillScore: 50,
          workloadScore: willExceed ? 0 : Math.round(Math.max(0, 1 - (projectedLoad / capacity)) * 30),
          maxWorkloadScore: 30,
          experienceScore: expLevel === 'Senior' ? 20 : (expLevel === 'Mid' ? 15 : 10),
          maxExperienceScore: 20,

          skillPercent: skillMatchPercent,
          matchedSkills,
          missingSkills,
          hasSkillRequirements: reqSkills.length > 0,
          currentLoadHours: currentAssigned,
          capacityHours: capacity,
          projectedLoadHours: Math.round(projectedLoad * 10) / 10,
          willExceedCapacity: willExceed,
          excessHours,
          experienceLevel: expLevel
        }
      };
    });

    // Sort by overall match score descending; tie-break on lower current workload, then higher skill match %
    list.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (a.currentWorkloadHours !== b.currentWorkloadHours) return a.currentWorkloadHours - b.currentWorkloadHours;
      return b.skillMatchPercent - a.skillMatchPercent;
    });

    // Assign rank and document reasons why candidates below rank 1 were ranked lower
    const topCand = list[0];
    list.forEach((cand, idx) => {
      cand.rank = idx + 1;
      if (idx > 0 && topCand) {
        const notRecReasons = [];
        if (cand.willExceedCapacity) {
          notRecReasons.push(`Exceeds weekly capacity limit by ${cand.excessHours} hours`);
        }
        if (cand.skillMatchPercent < topCand.skillMatchPercent) {
          notRecReasons.push(`Lower skill compatibility (${cand.skillMatchPercent}% vs ${topCand.skillMatchPercent}% for #${topCand.rank})`);
        }
        if (cand.currentWorkloadHours > topCand.currentWorkloadHours) {
          notRecReasons.push(`Higher current assigned workload (${cand.currentWorkloadHours}h vs ${topCand.currentWorkloadHours}h for #${topCand.rank})`);
        }
        if (cand.experienceLevel !== topCand.experienceLevel && topCand.experienceLevel === 'Senior') {
          notRecReasons.push(`Less experience suitability (${cand.experienceLevel} vs Senior)`);
        }
        if (notRecReasons.length === 0) {
          notRecReasons.push(`Marginal score differential (${cand.totalScore}% vs ${topCand.totalScore}%)`);
        }
        cand.notRecommendedReasons = notRecReasons;
      }
    });

    const topRecommendations = list.slice(0, 3);

    return {
      recommendations: list,
      topRecommendations,
      allRankedCandidates: list,
      totalEligible: allDevs.length,
      hasData: true,
      algorithmDoc: '5-factor normalized multi-criteria weighting: Skills (40%), Experience (20%), Availability (20%), Workload (15%), Historical Performance (5%) with dynamic redistribution for missing fields.',
      message: 'Intelligent multi-criteria recommendation evaluated across all eligible developer records.'
    };
  }

  /**
   * Side-by-side Candidate Comparison Helper
   */
  compareCandidatesForTask(task, candidateIds = [], sprintId = null) {
    const recResult = this.recommendDevelopersForTask(task, sprintId);
    if (!recResult.hasData) return null;

    const candidates = candidateIds.length > 0
      ? recResult.recommendations.filter(c => candidateIds.includes(c.developerId))
      : recResult.topRecommendations;

    return {
      task,
      candidates,
      metrics: [
        { label: 'Rank', getValue: c => `#${c.rank}` },
        { label: 'Overall Match Score', getValue: c => `${c.totalScore}%` },
        { label: 'Skill Match %', getValue: c => `${c.skillMatchPercent}%` },
        { label: 'Matched Skills', getValue: c => c.matchedSkills.length > 0 ? c.matchedSkills.join(', ') : 'None' },
        { label: 'Missing Skills', getValue: c => c.missingSkills.length > 0 ? c.missingSkills.join(', ') : 'None' },
        { label: 'Experience Level', getValue: c => c.experienceLevel },
        { label: 'Experience Suitability', getValue: c => c.experienceSuitability },
        { label: 'Remaining Capacity', getValue: c => `${c.availableWorkingHours}h / ${c.maxWeeklyHours}h` },
        { label: 'Current Assigned Load', getValue: c => `${c.currentWorkloadHours}h` },
        { label: 'Overload Status', getValue: c => c.willExceedCapacity ? `⚠️ Overloaded by ${c.excessHours}h` : '✅ Within safe capacity' },
        { label: 'Key Reasons', getValue: c => c.recommendationReasons.slice(0, 2).join('; ') },
        { label: 'Potential Risks', getValue: c => c.potentialRisks.length > 0 ? c.potentialRisks.join('; ') : 'None identified' }
      ]
    };
  }

  /**
   * Save AI-Generated Agile Sprint Plan Atomically
   */
  saveAiSprintPlan(planData) {
    if (!planData || !planData.project || !Array.isArray(planData.sprints) || !Array.isArray(planData.tasks)) {
      return { success: false, error: 'Invalid plan structure.' };
    }

    const state = this.getState();
    const currentUser = this.getCurrentUser();

    // 1. Create Project
    const prjId = planData.project.id || this._generateId('PRJ');
    const project = {
      id: prjId,
      name: String(planData.project.name || planData.project.title || 'AI Generated Project').trim(),
      description: String(planData.project.description || planData.project.abstract || '').trim(),
      originalAbstract: String(planData.project.originalAbstract || planData.project.abstract || planData.project.description || '').trim(),
      objectives: String(planData.project.objectives || '').trim(),
      preferredStack: String(planData.project.preferredStack || '').trim(),
      startDate: planData.project.startDate || new Date().toISOString().split('T')[0],
      deadline: planData.project.deadline || '',
      sprintDurationDays: parseInt(planData.project.sprintDurationDays || (planData.project.sprintDurationWeeks ? planData.project.sprintDurationWeeks * 7 : 14)) || 14,
      status: 'Active',
      managerId: planData.project.managerId || (currentUser ? currentUser.id : null),
      teamMemberIds: [],
      aiGenerated: true,
      planVersion: 1,
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Project Manager',
      createdAt: new Date().toISOString()
    };

    // 2. Create Sprints
    const savedSprints = [];
    const sprintIdMap = {}; // tempIndex/tempId -> realSprintId

    planData.sprints.forEach((s, idx) => {
      const sprintId = this._generateId('SPR');
      if (s.tempId) sprintIdMap[s.tempId] = sprintId;
      sprintIdMap[idx] = sprintId;

      const sprintObj = {
        id: sprintId,
        projectId: prjId,
        name: String(s.name || `Sprint ${idx + 1}`).trim(),
        objective: String(s.objective || '').trim(),
        startDate: s.startDate || '',
        endDate: s.endDate || '',
        capacityHours: parseFloat(s.capacityHours) || 80,
        status: idx === 0 ? 'Active' : 'Planned',
        aiGenerated: true,
        groupingRationale: String(s.groupingRationale || '').trim(),
        createdAt: new Date().toISOString()
      };
      savedSprints.push(sprintObj);
    });

    // 3. Create Tasks & Map Dependencies
    const savedTasks = [];
    const taskIdMap = {}; // tempTaskId -> realTaskId
    const involvedDevIds = new Set();

    // First pass: assign real IDs
    planData.tasks.forEach((t) => {
      const realTaskId = this._generateId('TSK');
      if (t.tempId || t.id) taskIdMap[t.tempId || t.id] = realTaskId;
      t._realId = realTaskId;
    });

    // Second pass: save tasks with resolved dependencies and sprints
    planData.tasks.forEach((t) => {
      const realSprintId = sprintIdMap[t.sprintTempId] || sprintIdMap[t.sprintIndex] || (savedSprints[0] ? savedSprints[0].id : null);
      const mappedDependencies = (t.dependencies || []).map(depId => taskIdMap[depId] || depId);

      if (t.assigneeId) {
        involvedDevIds.add(t.assigneeId);
      }

      const taskObj = {
        id: t._realId,
        projectId: prjId,
        sprintId: realSprintId,
        title: String(t.title).trim(),
        description: String(t.description || '').trim(),
        module: String(t.module || 'General').trim(),
        requiredSkills: Array.isArray(t.requiredSkills) ? t.requiredSkills : [],
        priority: t.priority || 'Medium',
        storyPoints: parseInt(t.storyPoints) || 3,
        estimatedHours: parseFloat(t.estimatedHours) || 8,
        actualHours: 0,
        status: 'To Do',
        dependencies: mappedDependencies,
        acceptanceCriteria: Array.isArray(t.acceptanceCriteria) ? t.acceptanceCriteria : [],
        assigneeId: t.assigneeId || null,
        pmOverride: t.pmOverride || null,
        aiGenerated: true,
        manuallyEdited: t.manuallyEdited || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      savedTasks.push(taskObj);
    });

    // Update project team members with all assigned developers
    project.teamMemberIds = Array.from(involvedDevIds);

    // Commit to state
    state.projects.push(project);
    savedSprints.forEach(s => state.sprints.push(s));
    savedTasks.forEach(t => state.tasks.push(t));

    // Set as active project
    state.session.activeProjectId = prjId;

    this.saveState(state);

    return {
      success: true,
      projectId: prjId,
      project,
      sprints: savedSprints,
      tasks: savedTasks
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

  /**
   * Rule 5: Assignment Validator with PM Override Control
   * Verifies that the developer meets requirements and has sufficient capacity.
   * If not, flags that an explicit Project Manager Override is required.
   */
  validateAssignment(taskId, developerId, sprintId = null) {
    const task = this.getTaskById(taskId);
    if (!task) return { valid: false, error: 'Task not found.' };
    if (!developerId) return { valid: true, requiresOverride: false, issues: [] };

    const dev = this.getUserById(developerId);
    if (!dev) return { valid: false, error: 'Developer not found.' };

    const issues = [];
    const targetSprint = sprintId || task.sprintId;
    const est = parseFloat(task.estimatedHours) || 0;
    const workload = this.calculateDeveloperWorkload(developerId, targetSprint);
    const currentAssigned = workload ? workload.assignedHours : 0;
    const isCurrentlyAssigned = (task.assigneeId === developerId);
    const projectedAssigned = currentAssigned + (isCurrentlyAssigned ? 0 : est);
    const maxCapacity = dev.maxWeeklyHours || 40;

    const willExceedCapacity = (maxCapacity > 0 && projectedAssigned > maxCapacity);
    if (willExceedCapacity) {
      const excess = Math.round((projectedAssigned - maxCapacity) * 10) / 10;
      issues.push(`Capacity Exceeded: Increases load to ${projectedAssigned}h / ${maxCapacity}h (exceeds weekly limit by ${excess}h).`);
    }

    const skillEval = this.calculateSkillMatch(task.requiredSkills, dev.skills);
    if (task.requiredSkills && task.requiredSkills.length > 0 && skillEval.matchedSkills.length === 0) {
      issues.push(`Skill Requirement Not Met: Developer lacks required skills [${task.requiredSkills.join(', ')}].`);
    }

    return {
      valid: true,
      requiresOverride: issues.length > 0,
      willExceedCapacity,
      skillIssues: skillEval.missingSkills,
      issues,
      developer: dev,
      task
    };
  }

  /**
   * Rule 6: Unassigned Developers Audit & Allocation Explainer
   * Evaluates all developers who have no tasks in the sprint/project.
   * Explains why no assignment was made without forcing developers to receive tasks.
   */
  getUnassignedDevelopersExplanation(projectId, sprintId = null) {
    const allDevs = this.getDevelopers();
    const project = projectId ? this.getProjectById(projectId) : null;

    const eligibleDevs = allDevs.filter(dev => {
      if (!project || !project.teamMemberIds || project.teamMemberIds.length === 0) return true;
      return project.teamMemberIds.includes(dev.id);
    });

    const activeTasks = sprintId 
      ? this.getTasksBySprint(sprintId) 
      : (projectId ? this.getTasksByProject(projectId) : this.getTasks());

    const pendingBacklogTasks = projectId
      ? this.getTasksByProject(projectId).filter(t => !t.sprintId && t.status !== 'Done')
      : this.getTasks().filter(t => !t.sprintId && t.status !== 'Done');

    const result = [];

    eligibleDevs.forEach(dev => {
      const assignedToDev = activeTasks.filter(t => t.assigneeId === dev.id);
      if (assignedToDev.length === 0) {
        let reason = '';
        let statusTag = 'Available';

        if (!dev.maxWeeklyHours || dev.maxWeeklyHours <= 0) {
          reason = 'Developer has 0 configured weekly capacity hours.';
          statusTag = 'Inactive';
        } else if (pendingBacklogTasks.length === 0 && activeTasks.length === 0) {
          reason = 'No active sprint tasks or backlog tasks exist in this project.';
          statusTag = 'Idle';
        } else {
          const matchingTasks = pendingBacklogTasks.filter(task => {
            if (!task.requiredSkills || task.requiredSkills.length === 0) return true;
            const match = this.calculateSkillMatch(task.requiredSkills, dev.skills);
            return match.matchedSkills.length > 0;
          });

          if (matchingTasks.length === 0 && pendingBacklogTasks.length > 0) {
            reason = `No pending backlog tasks match developer's skills (${dev.skills.join(', ') || 'No skills listed'}).`;
            statusTag = 'Skill Mismatch';
          } else {
            reason = `Developer is fully available (${dev.maxWeeklyHours}h/week capacity). Remaining backlog tasks were allocated to higher-ranked candidates or are uncommitted.`;
            statusTag = 'Available Capacity';
          }
        }

        result.push({
          developer: dev,
          statusTag,
          reason,
          availableHours: dev.maxWeeklyHours || 40,
          skills: dev.skills || []
        });
      }
    });

    return result;
  }
}

// Global Singleton Instance
window.storageManager = new StorageManager();
