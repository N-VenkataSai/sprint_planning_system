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
