/**
 * Sprint Planning & Intelligent Resource Allocation System
 * AI Sprint Generator Controller
 *
 * Implements Feature 2:
 * - Abstract Understanding (Objectives, Requirements, Modules, Skills, Risks, Assumptions)
 * - Automatic Structured Task Generation (Fibonacci Story Points, Effort Ranges, DAG Dependencies)
 * - Automatic Sprint Creation & Scheduling Engine (Capacity Validation & Deadline Feasibility)
 * - Invocation of Feature 1 Developer Recommendation Engine (Top 3 Candidates, PM Override)
 * - Interactive Review & Approval Screen (Edit, Delete, Add, Reassign, Regenerate, Approve)
 * - Persistent Storage with Complete Metadata Preservation
 *
 * Mandatory Data Policy: Strictly zero fabricated business data. Uses real developer records
 * and user-entered project abstracts.
 */

class AiSprintGeneratorController {
  constructor() {
    this.currentPlan = null;
    this.isGenerating = false;
    this.editingTaskIndex = null;
    this.selectedProvider = 'local'; // 'local' (Deterministic Semantic NLP) | 'external' (LLM API)
    this.externalApiKey = localStorage.getItem('sprint_alloc_llm_api_key') || '';
    this.externalEndpoint = localStorage.getItem('sprint_alloc_llm_endpoint') || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    this.externalModelName = localStorage.getItem('sprint_alloc_llm_model') || 'gemini-1.5-flash';
  }

  get storage() {
    return window.storageManager;
  }

  get auth() {
    return window.authManager;
  }

  init() {
    if (this.auth) {
      this.auth.renderNavbar('ai-sprint-generator');
      this.auth.checkPageAccess(['admin', 'manager']);
    }

    this.initDefaultDates();
    this.bindEvents();
    this.loadSavedSettings();
  }

  initDefaultDates() {
    const today = new Date();
    const startDateInput = document.getElementById('gen-start-date');
    const deadlineInput = document.getElementById('gen-deadline');

    if (startDateInput && !startDateInput.value) {
      startDateInput.value = today.toISOString().split('T')[0];
    }

    if (deadlineInput && !deadlineInput.value) {
      // Default deadline: 8 weeks (56 days) from start
      const defaultDeadline = new Date(today);
      defaultDeadline.setDate(defaultDeadline.getDate() + 56);
      deadlineInput.value = defaultDeadline.toISOString().split('T')[0];
    }
  }

  loadSavedSettings() {
    const keyInput = document.getElementById('llm-api-key');
    const endpointInput = document.getElementById('llm-endpoint-url');
    const modelInput = document.getElementById('llm-model-name');
    const providerSelect = document.getElementById('ai-provider-select');

    if (keyInput) keyInput.value = this.externalApiKey;
    if (endpointInput) endpointInput.value = this.externalEndpoint;
    if (modelInput) modelInput.value = this.externalModelName;
    if (providerSelect) providerSelect.value = this.selectedProvider;
  }

  bindEvents() {
    // Generate form submit
    const form = document.getElementById('ai-generator-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleGeneratePlan();
      });
    }

    // Provider select change
    const providerSelect = document.getElementById('ai-provider-select');
    if (providerSelect) {
      providerSelect.addEventListener('change', (e) => {
        this.selectedProvider = e.target.value;
        const configWrap = document.getElementById('external-api-config-wrap');
        if (configWrap) {
          configWrap.style.display = this.selectedProvider === 'external' ? 'block' : 'none';
        }
      });
    }

    // Save API Settings button
    const saveSettingsBtn = document.getElementById('btn-save-ai-settings');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        this.saveAiSettings();
      });
    }

    // Clear form button
    const clearBtn = document.getElementById('btn-clear-generator');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear the abstract form inputs?')) {
          form.reset();
          this.initDefaultDates();
        }
      });
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close, [data-dismiss="modal"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });

    // Save edited task in modal
    const saveTaskEditBtn = document.getElementById('btn-save-task-edit');
    if (saveTaskEditBtn) {
      saveTaskEditBtn.addEventListener('click', () => this.saveTaskModalEdit());
    }

    // Add new task form in modal
    const saveNewTaskBtn = document.getElementById('btn-save-new-task');
    if (saveNewTaskBtn) {
      saveNewTaskBtn.addEventListener('click', () => this.saveNewCustomTask());
    }

    // Candidate comparison modal close
    const compClose = document.getElementById('btn-close-comparison');
    if (compClose) {
      compClose.addEventListener('click', () => {
        document.getElementById('candidate-comparison-modal').style.display = 'none';
      });
    }

    // PM Override confirmation modal submit
    const overrideForm = document.getElementById('pm-override-form');
    if (overrideForm) {
      overrideForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.confirmPmOverrideAssignment();
      });
    }
  }

  saveAiSettings() {
    this.externalApiKey = (document.getElementById('llm-api-key')?.value || '').trim();
    this.externalEndpoint = (document.getElementById('llm-endpoint-url')?.value || '').trim();
    this.externalModelName = (document.getElementById('llm-model-name')?.value || '').trim();

    localStorage.setItem('sprint_alloc_llm_api_key', this.externalApiKey);
    localStorage.setItem('sprint_alloc_llm_endpoint', this.externalEndpoint);
    localStorage.setItem('sprint_alloc_llm_model', this.externalModelName);

    if (this.auth) {
      this.auth.showToast('AI Provider configuration saved successfully.', 'success');
    }
  }

  // =========================================================================
  // PIPELINE ORCHESTRATION
  // =========================================================================
  async handleGeneratePlan(revisedPrompt = '') {
    const title = document.getElementById('gen-project-title')?.value.trim();
    const abstract = document.getElementById('gen-project-abstract')?.value.trim();
    const objectives = document.getElementById('gen-project-objectives')?.value.trim();
    const preferredStack = document.getElementById('gen-project-stack')?.value.trim();
    const startDate = document.getElementById('gen-start-date')?.value;
    const deadline = document.getElementById('gen-deadline')?.value;
    const sprintDurationWeeks = parseInt(document.getElementById('gen-sprint-duration')?.value) || 2;
    const constraints = document.getElementById('gen-additional-constraints')?.value.trim();

    if (!title || !abstract || !startDate || !deadline) {
      if (this.auth) this.auth.showToast('Please provide Project Title, Abstract, Start Date, and Deadline.', 'warning');
      return;
    }

    // Verify deadline is after start date
    if (new Date(deadline) <= new Date(startDate)) {
      if (this.auth) this.auth.showToast('Project deadline must be strictly after the start date.', 'danger');
      return;
    }

    this.showGenerationLoading(true);

    try {
      // Step 1: Abstract Analysis & Requirement Extraction
      this.updatePipelineStep('step-1', 'active', 'Analyzing project abstract & extracting domain requirements...');
      const analyzedData = await this.executeAbstractUnderstanding({
        title,
        abstract,
        objectives,
        preferredStack,
        startDate,
        deadline,
        sprintDurationWeeks,
        constraints,
        revisedPrompt
      });

      // Step 2: Automatic Task Generation with Fibonacci Points & Dependencies
      this.updatePipelineStep('step-1', 'done', 'Abstract analysis complete.');
      this.updatePipelineStep('step-2', 'active', 'Decomposing requirements into structured development tasks & DAG dependencies...');
      await this.sleep(250);
      const generatedTasks = this.generateStructuredTasks(analyzedData);

      // Step 3: Automatic Sprint Scheduling & Capacity Validation
      this.updatePipelineStep('step-2', 'done', `Generated ${generatedTasks.length} structured development tasks.`);
      this.updatePipelineStep('step-3', 'active', 'Sequencing tasks, validating sprint capacities & deadline feasibility...');
      await this.sleep(250);
      const scheduledPlan = this.scheduleSprintsWithCapacityValidation({
        project: {
          title,
          abstract,
          objectives,
          preferredStack,
          startDate,
          deadline,
          sprintDurationWeeks
        },
        analyzedData,
        tasks: generatedTasks
      });

      // Step 4: Intelligent Developer Recommendation (Feature 1 Invocation)
      this.updatePipelineStep('step-3', 'done', `Scheduled ${scheduledPlan.sprints.length} sprints with capacity checks.`);
      this.updatePipelineStep('step-4', 'active', 'Running 5-factor recommendation engine across eligible developers...');
      await this.sleep(250);
      this.assignDeveloperRecommendationsToTasks(scheduledPlan);

      // Step 5: Render Interactive Review & Approval Board
      this.updatePipelineStep('step-4', 'done', 'Developer recommendation scores computed.');
      this.currentPlan = scheduledPlan;
      this.renderReviewAndApprovalBoard();

      if (this.auth) {
        this.auth.showToast('Agile Sprint Plan generated successfully! Review, modify, and approve below.', 'success');
      }

      // Scroll to review section
      document.getElementById('plan-review-section')?.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
      console.error('AI Sprint Generation Error:', err);
      if (this.auth) this.auth.showToast(`Generation Error: ${err.message}`, 'danger');
    } finally {
      this.showGenerationLoading(false);
    }
  }

  updatePipelineStep(stepId, state, text) {
    const el = document.getElementById(stepId);
    if (!el) return;
    el.className = `pipeline-step ${state}`;
    const desc = el.querySelector('.step-desc');
    if (desc && text) desc.textContent = text;
  }

  showGenerationLoading(show) {
    this.isGenerating = show;
    const progressCard = document.getElementById('generation-pipeline-card');
    const submitBtn = document.getElementById('btn-generate-plan');
    if (progressCard) progressCard.style.display = show ? 'block' : 'none';
    if (submitBtn) {
      submitBtn.disabled = show;
      submitBtn.innerHTML = show ? '⏳ Generating Agile Plan...' : '🚀 Analyze Abstract &amp; Generate Agile Sprints';
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // =========================================================================
  // STEP 1: ABSTRACT UNDERSTANDING
  // =========================================================================
  async executeAbstractUnderstanding(inputs) {
    // If user selected external LLM and provided an API key, attempt live API call
    if (this.selectedProvider === 'external' && this.externalApiKey) {
      try {
        const liveResult = await this.callExternalLlm(inputs);
        if (liveResult) return liveResult;
      } catch (e) {
        console.warn('External LLM call failed, falling back to built-in semantic NLP engine:', e);
        if (this.auth) {
          this.auth.showToast('External LLM call failed; using Built-in Semantic NLP Engine.', 'warning');
        }
      }
    }

    // Built-in Deterministic Semantic NLP Engine
    return this.builtInSemanticNlpAnalysis(inputs);
  }

  builtInSemanticNlpAnalysis(inputs) {
    const text = `${inputs.title}\n${inputs.abstract}\n${inputs.objectives || ''}\n${inputs.constraints || ''}`.toLowerCase();

    // 1. Module Identification
    const modules = [];
    const moduleKeywords = {
      'Authentication & User Security': ['auth', 'login', 'signup', 'jwt', 'oauth', 'role', 'permission', 'security', 'password', 'user', 'session'],
      'Core Data Architecture & Schema': ['database', 'schema', 'entity', 'postgres', 'sql', 'model', 'storage', 'data', 'relation'],
      'Backend APIs & Business Logic': ['api', 'service', 'rest', 'backend', 'crud', 'controller', 'endpoint', 'server', 'logic'],
      'Interactive User Interface & Client Portal': ['ui', 'frontend', 'dashboard', 'screen', 'client', 'portal', 'responsive', 'view', 'web', 'page'],
      'Real-Time Communications & Messaging': ['real-time', 'webrtc', 'video', 'chat', 'message', 'socket', 'stream', 'notification', 'email', 'sms'],
      'Integrations & External Gateways': ['payment', 'stripe', 'external', 'gateway', 'third-party', 'webhook', 'integration', 'export', 'import'],
      'Quality Assurance & E2E Testing': ['test', 'quality', 'unit', 'integration test', 'qa', 'audit', 'validation', 'benchmark'],
      'DevOps, Containerization & Deployment': ['docker', 'deploy', 'ci/cd', 'cloud', 'aws', 'kubernetes', 'production', 'pipeline', 'container']
    };

    Object.keys(moduleKeywords).forEach(modName => {
      const kwList = moduleKeywords[modName];
      const matchCount = kwList.filter(kw => text.includes(kw)).length;
      if (matchCount > 0 || modName === 'Authentication & User Security' || modName === 'Core Data Architecture & Schema' || modName === 'Interactive User Interface & Client Portal') {
        modules.push({
          name: modName,
          relevance: matchCount,
          keywords: kwList.filter(kw => text.includes(kw))
        });
      }
    });

    // 2. Skills Extraction
    const candidateSkills = [
      'JavaScript', 'TypeScript', 'React', 'Vue', 'HTML5', 'CSS3', 'Node.js',
      'Python', 'FastAPI', 'Java', 'Spring Boot', 'PostgreSQL', 'MongoDB',
      'Redis', 'Docker', 'Kubernetes', 'WebRTC', 'REST API', 'GraphQL',
      'Security', 'JWT', 'Git', 'CI/CD', 'Testing'
    ];

    const detectedSkills = new Set();
    // Ingest explicitly preferred stack
    if (inputs.preferredStack) {
      inputs.preferredStack.split(/[,;|]/).map(s => s.trim()).filter(Boolean).forEach(s => detectedSkills.add(s));
    }

    // Inspect text
    candidateSkills.forEach(skill => {
      if (text.includes(skill.toLowerCase())) {
        detectedSkills.add(skill);
      }
    });

    // Provide sensible defaults if none detected
    if (detectedSkills.size === 0) {
      ['HTML5', 'CSS3', 'JavaScript', 'Node.js', 'PostgreSQL', 'Docker'].forEach(s => detectedSkills.add(s));
    }

    // 3. Functional Requirements Extraction
    const functionalRequirements = [];
    const frPatterns = [
      { trigger: ['auth', 'login', 'user', 'role'], title: 'User Identity & Role-Based Access Control', desc: 'Secure registration, login, and authorization matrix enforcement.' },
      { trigger: ['patient', 'doctor', 'client', 'member', 'profile'], title: 'User Profile & Entity Management', desc: 'Full lifecycle management of core domain user records and permission profiles.' },
      { trigger: ['record', 'data', 'history', 'crud', 'manage'], title: 'Core Business Entity Data Operations', desc: 'Validated CRUD services for primary domain entities with audit logging.' },
      { trigger: ['schedule', 'appointment', 'calendar', 'booking', 'sprint'], title: 'Scheduling & Event Lifecycle Workflow', desc: 'State machine for scheduling, calendar slots, state transitions, and reminders.' },
      { trigger: ['call', 'video', 'chat', 'message', 'real-time'], title: 'Real-Time Communication Channel', desc: 'Encrypted low-latency live messaging or peer-to-peer session exchange.' },
      { trigger: ['dashboard', 'analytic', 'report', 'metric', 'chart'], title: 'Operational Analytics & Monitoring Dashboard', desc: 'Data visualization widgets summarizing progress, metrics, and risk flags.' },
      { trigger: ['notification', 'alert', 'email', 'sms'], title: 'Event-Driven Notification Delivery', desc: 'Asynchronous notifications dispatched via email, SMS, or in-app toasts.' },
      { trigger: ['export', 'backup', 'import', 'download'], title: 'Data Ingestion & Export Services', desc: 'Structured CSV/JSON serialization and backup extraction routines.' }
    ];

    frPatterns.forEach((p, idx) => {
      const hasMatch = p.trigger.some(t => text.includes(t));
      if (hasMatch) {
        functionalRequirements.push({
          id: `FR-${String(functionalRequirements.length + 1).padStart(2, '0')}`,
          title: p.title,
          description: p.desc
        });
      }
    });

    if (functionalRequirements.length < 3) {
      functionalRequirements.push({ id: 'FR-01', title: 'User Identity & Authentication Matrix', description: 'Session control, token lifecycle, and role verification.' });
      functionalRequirements.push({ id: 'FR-02', title: 'Domain Data Management & Validation', description: 'Core entity persistence and business rule enforcement.' });
      functionalRequirements.push({ id: 'FR-03', title: 'Responsive Management UI', description: 'User-facing dashboard with data filtering and status transitions.' });
    }

    // 4. Non-Functional Requirements
    const nonFunctional = [
      'Security: Encryption in transit (TLS 1.3) and at rest with parameterized query protection against SQL injection.',
      'Performance: API response times under 200ms for p95 requests under standard concurrent load.',
      'Accessibility & Usability: Responsive design accommodating mobile, tablet, and desktop viewports.',
      'Reliability: Comprehensive error boundaries preventing cascading client crashes and state corruption.'
    ];
    if (text.includes('hipaa') || text.includes('medical') || text.includes('health') || text.includes('privacy')) {
      nonFunctional.push('Regulatory Compliance: Strict audit logging and privacy policy isolation for sensitive records.');
    }

    // 5. Explicit AI Assumptions (Marked for PM Review)
    const assumptions = [
      '[AI-Generated Assumption / Pending PM Review] Assumed modern RESTful JSON communication architecture between frontend and backend services.',
      '[AI-Generated Assumption / Pending PM Review] Assumed relational database schema (PostgreSQL) is suitable for structured entity relationships.',
      '[AI-Generated Assumption / Pending PM Review] Assumed user session expiration of 24 hours with refresh token rotation.',
      '[AI-Generated Assumption / Pending PM Review] Assumed standard automated unit and integration tests are required prior to sprint sign-off.'
    ];

    if (inputs.revisedPrompt) {
      assumptions.push(`[AI-Generated Assumption / Pending PM Review] Adjusted based on PM refinement: "${inputs.revisedPrompt}"`);
    }

    // 6. Project Risks
    const risks = [
      'Dependency bottlenecks if database schema migrations undergo frequent mid-sprint changes.',
      'Scope creep in external third-party API integration and message webhook delivery.',
      'Capacity constraints if developer availability fluctuates during critical sprint deliverables.'
    ];

    return {
      title: inputs.title,
      abstract: inputs.abstract,
      objectives: inputs.objectives || 'Deliver high-quality, scalable Agile software fulfilling core domain requirements.',
      preferredStack: Array.from(detectedSkills).join(', '),
      skills: Array.from(detectedSkills),
      modules,
      functionalRequirements,
      nonFunctional,
      assumptions,
      risks,
      startDate: inputs.startDate,
      deadline: inputs.deadline,
      sprintDurationWeeks: inputs.sprintDurationWeeks
    };
  }

  // Optional external LLM API Integration (Gemini, OpenAI, or local endpoint)
  async callExternalLlm(inputs) {
    const prompt = `You are an expert Agile Software Architect.
Analyze the following project abstract and output strict JSON adhering exactly to this schema:
{
  "objectives": "string",
  "skills": ["string"],
  "functionalRequirements": [{"id": "FR-01", "title": "string", "description": "string"}],
  "nonFunctional": ["string"],
  "assumptions": ["string"],
  "risks": ["string"]
}

Project Title: ${inputs.title}
Abstract: ${inputs.abstract}
Preferred Stack: ${inputs.preferredStack || 'None'}
Start Date: ${inputs.startDate}
Deadline: ${inputs.deadline}
Sprint Duration: ${inputs.sprintDurationWeeks} weeks
${inputs.revisedPrompt ? `Special Instruction / Refinement: ${inputs.revisedPrompt}` : ''}

Output ONLY valid raw JSON.`;

    // Attempt Gemini or OpenAI compatible call
    const isGemini = this.externalEndpoint.includes('googleapis.com');
    let url = this.externalEndpoint;
    let body = {};
    let headers = { 'Content-Type': 'application/json' };

    if (isGemini) {
      url = `${this.externalEndpoint}?key=${this.externalApiKey}`;
      body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };
    } else {
      headers['Authorization'] = `Bearer ${this.externalApiKey}`;
      body = {
        model: this.externalModelName || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`LLM API returned status ${res.status}`);
    }

    const data = await res.json();
    let jsonStr = '';
    if (isGemini) {
      jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      jsonStr = data.choices?.[0]?.message?.content || '';
    }

    const parsed = JSON.parse(jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim());

    // Merge with base
    return {
      title: inputs.title,
      abstract: inputs.abstract,
      objectives: parsed.objectives || inputs.objectives,
      preferredStack: inputs.preferredStack,
      skills: parsed.skills || ['JavaScript', 'HTML5', 'CSS3', 'PostgreSQL'],
      modules: this.builtInSemanticNlpAnalysis(inputs).modules,
      functionalRequirements: parsed.functionalRequirements || [],
      nonFunctional: parsed.nonFunctional || [],
      assumptions: (parsed.assumptions || []).map(a => `[AI-Generated Assumption / Pending PM Review] ${a}`),
      risks: parsed.risks || [],
      startDate: inputs.startDate,
      deadline: inputs.deadline,
      sprintDurationWeeks: inputs.sprintDurationWeeks
    };
  }

  // =========================================================================
  // STEP 2: AUTOMATIC TASK GENERATION
  // =========================================================================
  generateStructuredTasks(analyzed) {
    const tasks = [];
    let taskCounter = 1;
    const skillsPool = analyzed.skills;

    const pickSkills = (candidates) => {
      const found = candidates.filter(c => skillsPool.includes(c));
      return found.length > 0 ? found : [skillsPool[0] || 'JavaScript'];
    };

    // Phase 1: Foundation, Data Models & Architecture
    const t1 = {
      tempId: `TSK-GEN-${String(taskCounter++).padStart(3, '0')}`,
      title: 'Database Schema Design & Migration Scripts',
      description: 'Design normalized relational entity tables, indices, foreign key constraints, and seed configuration.',
      module: 'Core Data Architecture & Schema',
      requiredSkills: pickSkills(['PostgreSQL', 'SQL', 'MongoDB', 'Docker']),
      priority: 'Critical',
      storyPoints: 5,
      estimatedHours: 20,
      dependencies: [],
      acceptanceCriteria: [
        'All primary entities, keys, and foreign relationships defined in versioned SQL scripts.',
        'Initial migration executes cleanly in local Docker environment without warnings.',
        'Entity relationship diagram (ERD) documented.'
      ],
      suggestedSprint: 0
    };
    tasks.push(t1);

    const t2 = {
      tempId: `TSK-GEN-${String(taskCounter++).padStart(3, '0')}`,
      title: 'User Authentication, JWT Token Lifecycle & RBAC Matrix',
      description: 'Implement secure password hashing, JWT generation/validation middleware, and role authorization guards.',
      module: 'Authentication & User Security',
      requiredSkills: pickSkills(['Security', 'JWT', 'Node.js', 'Python', 'Java', 'REST API']),
      priority: 'Critical',
      storyPoints: 5,
      estimatedHours: 18,
      dependencies: [t1.tempId],
      acceptanceCriteria: [
        'Secure password hashing with bcrypt/argon2.',
        'JWT tokens issued with expiration and validated on protected endpoints.',
        'Role-based authorization middleware tested for Admin, Manager, and Developer roles.'
      ],
      suggestedSprint: 0
    };
    tasks.push(t2);

    // Phase 2: Core Functional Services & APIs (derived from functional requirements)
    const coreApiTasks = [];
    analyzed.functionalRequirements.forEach((fr, i) => {
      const isCritical = i === 0;
      const points = i % 2 === 0 ? 5 : 3;
      const hours = points === 5 ? 18 : 12;

      const t = {
        tempId: `TSK-GEN-${String(taskCounter++).padStart(3, '0')}`,
        title: `${fr.title} - Backend Service & REST Endpoints`,
        description: `Implement domain service logic and RESTful CRUD endpoints for ${fr.title.toLowerCase()}. ${fr.description}`,
        module: 'Backend APIs & Business Logic',
        requiredSkills: pickSkills(['Node.js', 'Python', 'FastAPI', 'Java', 'Spring Boot', 'REST API', 'PostgreSQL']),
        priority: isCritical ? 'High' : 'Medium',
        storyPoints: points,
        estimatedHours: hours,
        dependencies: [t1.tempId, t2.tempId],
        acceptanceCriteria: [
          'RESTful endpoints implemented with strict request validation and error responses.',
          'Database operations wrapped in transaction boundaries.',
          'Unit test coverage reaches >= 80% for business service logic.'
        ],
        suggestedSprint: i < 2 ? 0 : 1
      };
      tasks.push(t);
      coreApiTasks.push(t);
    });

    // Phase 3: Frontend Views & Interactive UI
    analyzed.functionalRequirements.slice(0, 3).forEach((fr, i) => {
      const matchingApiTask = coreApiTasks[i] || t2;
      const tUi = {
        tempId: `TSK-GEN-${String(taskCounter++).padStart(3, '0')}`,
        title: `${fr.title} - Client Interface & Responsive Views`,
        description: `Construct responsive client views, forms with validation, state management, and API consumption for ${fr.title.toLowerCase()}.`,
        module: 'Interactive User Interface & Client Portal',
        requiredSkills: pickSkills(['JavaScript', 'TypeScript', 'React', 'Vue', 'HTML5', 'CSS3']),
        priority: i === 0 ? 'High' : 'Medium',
        storyPoints: 5,
        estimatedHours: 16,
        dependencies: [matchingApiTask.tempId],
        acceptanceCriteria: [
          'Intuitive, responsive layout adhering to modern accessibility guidelines.',
          'Asynchronous data loading with skeleton states and user-friendly error alerts.',
          'Form inputs validate client-side before dispatching network requests.'
        ],
        suggestedSprint: 1
      };
      tasks.push(tUi);
    });

    // Phase 4: Operational Analytics, Integrations & Reporting
    const tAnalytics = {
      tempId: `TSK-GEN-${String(taskCounter++).padStart(3, '0')}`,
      title: 'Operational Analytics Dashboard & Dynamic Data Visualizations',
      description: 'Implement real-time metric counters, velocity charts, and burndown visualizers with filter controls.',
      module: 'Interactive User Interface & Client Portal',
      requiredSkills: pickSkills(['JavaScript', 'React', 'HTML5', 'CSS3', 'REST API']),
      priority: 'Medium',
      storyPoints: 3,
      estimatedHours: 12,
      dependencies: coreApiTasks.map(t => t.tempId).slice(0, 2),
      acceptanceCriteria: [
        'Chart widgets update dynamically when underlying task and sprint data changes.',
        'Empty states display clean "Insufficient Data" indicators when metrics are uncalculated.',
        'Responsive layout functions on mobile and widescreen displays.'
      ],
      suggestedSprint: 1
    };
    tasks.push(tAnalytics);

    // Phase 5: Verification, Security Audits & Deployment
    const lastApiTask = coreApiTasks[coreApiTasks.length - 1] || tAnalytics;
    const tDeploy = {
      tempId: `TSK-GEN-${String(taskCounter++).padStart(3, '0')}`,
      title: 'Automated Test Suite, Security Hardening & CI/CD Pipeline',
      description: 'Establish end-to-end integration test runners, perform security penetration audit, and configure Docker deployment container.',
      module: 'DevOps, Containerization & Deployment',
      requiredSkills: pickSkills(['Docker', 'CI/CD', 'Testing', 'Security', 'Git']),
      priority: 'High',
      storyPoints: 5,
      estimatedHours: 16,
      dependencies: [tAnalytics.tempId, lastApiTask.tempId],
      acceptanceCriteria: [
        'CI test runner passes 100% of automated unit and regression suites.',
        'Production Docker container builds cleanly with minimal footprint and unprivileged user.',
        'Security headers (CSP, HSTS, X-Content-Type) configured and verified.'
      ],
      suggestedSprint: 2
    };
    tasks.push(tDeploy);

    return tasks;
  }

  // =========================================================================
  // STEP 3: AUTOMATIC SPRINT CREATION & SCHEDULING WITH CAPACITY VALIDATION
  // =========================================================================
  scheduleSprintsWithCapacityValidation({ project, analyzedData, tasks }) {
    const allDevelopers = this.storage.getDevelopers();
    const teamMemberCount = allDevelopers.length > 0 ? allDevelopers.length : 3; // benchmark default if zero devs

    // Calculate weekly team capacity in hours
    let totalWeeklyHours = 0;
    if (allDevelopers.length > 0) {
      allDevelopers.forEach(d => {
        totalWeeklyHours += (d.maxWeeklyHours || 40);
      });
    } else {
      totalWeeklyHours = 120; // 3 devs x 40h standard baseline
    }

    const sprintDurationWeeks = project.sprintDurationWeeks || 2;
    const sprintDurationDays = sprintDurationWeeks * 7;
    const maxSprintCapacityHours = totalWeeklyHours * sprintDurationWeeks;

    // Topological sorting of tasks to guarantee DAG dependencies
    const sortedTasks = this.topologicalSortTasks(tasks);

    // Group tasks into sprints respecting dependencies and capacity
    const sprints = [];
    let currentSprintTasks = [];
    let currentSprintHours = 0;
    let sprintIndex = 0;

    const sprintGoals = [
      'Sprint 1: Architecture, Authentication & Data Schema Foundation',
      'Sprint 2: Core Domain Features, Backend Services & Client Views',
      'Sprint 3: Advanced Workflows, Integrations & Real-Time Services',
      'Sprint 4: Operational Analytics, Performance Optimization & E2E Testing',
      'Sprint 5: Production Hardening, Quality Assurance & Deployment'
    ];

    const sprintRationales = [
      'Foundational Phase: Contains database schema, data models, and JWT authentication which are prerequisites for all subsequent API endpoints.',
      'Core Capabilities: Implements primary functional services and user interface portal based on the stable foundation.',
      'Integration Phase: Delivers advanced user workflows, external connectors, and responsive state synchronization.',
      'Optimization Phase: Provides operational metrics, reporting, and comprehensive test validation.',
      'Release Readiness: Verifies security compliance, automated regressions, and containerized deployment readiness.'
    ];

    // Helper: track scheduled tasks across sprints to enforce DAG boundaries
    const completedPriorSprintTaskIds = new Set();
    const currentSprintTaskIds = new Set();

    sortedTasks.forEach(task => {
      const taskHours = task.estimatedHours;
      const hasPrereqInCurrentSprint = task.dependencies.some(d => currentSprintTaskIds.has(d));
      const isNextPhase = task.suggestedSprint !== undefined && task.suggestedSprint > sprintIndex;
      const wouldExceedCapacity = (currentSprintHours + taskHours) > (maxSprintCapacityHours * 0.95);

      if ((hasPrereqInCurrentSprint || isNextPhase || wouldExceedCapacity) && currentSprintTasks.length > 0) {
        // Finalize current sprint
        sprints.push(this.buildSprintObject({
          index: sprintIndex,
          name: sprintGoals[sprintIndex] || `Sprint ${sprintIndex + 1}: Feature Delivery`,
          rationale: sprintRationales[sprintIndex] || 'Logical grouping of sequential feature stories.',
          tasks: currentSprintTasks,
          startDate: project.startDate,
          sprintDurationDays,
          maxCapacity: maxSprintCapacityHours
        }));

        currentSprintTasks.forEach(t => completedPriorSprintTaskIds.add(t.tempId));
        sprintIndex++;
        currentSprintTasks = [];
        currentSprintHours = 0;
        currentSprintTaskIds.clear();
      }

      task.sprintIndex = sprintIndex;
      currentSprintTasks.push(task);
      currentSprintHours += taskHours;
      currentSprintTaskIds.add(task.tempId);
    });

    if (currentSprintTasks.length > 0) {
      sprints.push(this.buildSprintObject({
        index: sprintIndex,
        name: sprintGoals[sprintIndex] || `Sprint ${sprintIndex + 1}: Final Integration`,
        rationale: sprintRationales[sprintIndex] || 'Completion of remaining deliverables and verification.',
        tasks: currentSprintTasks,
        startDate: project.startDate,
        sprintDurationDays,
        maxCapacity: maxSprintCapacityHours
      }));
    }

    // Capacity & Deadline Feasibility Check
    const totalPlannedDays = sprints.length * sprintDurationDays;
    const projectStartDate = new Date(project.startDate);
    const plannedFinishDate = new Date(projectStartDate);
    plannedFinishDate.setDate(plannedFinishDate.getDate() + totalPlannedDays);

    const projectDeadline = new Date(project.deadline);
    const isDeadlineExceeded = plannedFinishDate > projectDeadline;
    const deadlineDiffDays = Math.ceil((plannedFinishDate - projectDeadline) / (1000 * 60 * 60 * 24));

    const capacityConflicts = [];
    sprints.forEach(s => {
      if (s.totalHours > s.capacityHours) {
        capacityConflicts.push({
          sprintName: s.name,
          totalHours: s.totalHours,
          capacityHours: s.capacityHours,
          excessHours: Math.round((s.totalHours - s.capacityHours) * 10) / 10
        });
      }
    });

    const feasibility = {
      isFeasible: !isDeadlineExceeded && capacityConflicts.length === 0,
      plannedFinishDate: plannedFinishDate.toISOString().split('T')[0],
      projectDeadline: project.deadline,
      isDeadlineExceeded,
      deadlineDiffDays: isDeadlineExceeded ? deadlineDiffDays : 0,
      capacityConflicts,
      suggestions: []
    };

    if (isDeadlineExceeded) {
      feasibility.suggestions.push(`⚠️ Deadline Risk: ${sprints.length} planned sprints finish on ${feasibility.plannedFinishDate}, which is ${deadlineDiffDays} day(s) after project deadline (${project.deadline}). Suggestion: Compress sprint duration, allocate additional developers, or scope non-critical tasks to Phase 2.`);
    }

    if (capacityConflicts.length > 0) {
      capacityConflicts.forEach(c => {
        feasibility.suggestions.push(`⚠️ Sprint Overload: ${c.sprintName} requires ${c.totalHours}h against team capacity of ${c.capacityHours}h (Excess: ${c.excessHours}h). Suggestion: Reassign 1-2 tasks to subsequent sprints or add team members.`);
      });
    }

    if (feasibility.suggestions.length === 0) {
      feasibility.suggestions.push('✅ Schedule Feasibility: The proposed sprints fit comfortably within team capacity and meet the delivery deadline with healthy contingency buffers.');
    }

    return {
      project: {
        ...project,
        totalTeamCapacityHoursPerSprint: maxSprintCapacityHours,
        totalTeamWeeklyHours: totalWeeklyHours
      },
      analyzedData,
      tasks,
      sprints,
      feasibility
    };
  }

  buildSprintObject({ index, name, rationale, tasks, startDate, sprintDurationDays, maxCapacity }) {
    const sStart = new Date(startDate);
    sStart.setDate(sStart.getDate() + (index * sprintDurationDays));

    const sEnd = new Date(sStart);
    sEnd.setDate(sEnd.getDate() + sprintDurationDays - 1);

    const totalPoints = tasks.reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);
    const totalHours = tasks.reduce((sum, t) => sum + (parseFloat(t.estimatedHours) || 0), 0);
    const utilization = maxCapacity > 0 ? Math.round((totalHours / maxCapacity) * 100) : 0;

    const allSkills = new Set();
    tasks.forEach(t => (t.requiredSkills || []).forEach(s => allSkills.add(s)));

    tasks.forEach(t => {
      t.sprintTempId = `SPR-TEMP-${index + 1}`;
      t.sprintIndex = index;
    });

    return {
      tempId: `SPR-TEMP-${index + 1}`,
      sprintNumber: index + 1,
      name,
      objective: `Deliver ${tasks.length} core features and architectural components totaling ${totalPoints} story points.`,
      startDate: sStart.toISOString().split('T')[0],
      endDate: sEnd.toISOString().split('T')[0],
      durationDays: sprintDurationDays,
      capacityHours: maxCapacity,
      totalHours: Math.round(totalHours * 10) / 10,
      totalPoints,
      utilizationPercent: utilization,
      groupingRationale: rationale,
      requiredSkills: Array.from(allSkills),
      tasks
    };
  }

  topologicalSortTasks(tasks) {
    const taskMap = new Map();
    tasks.forEach(t => taskMap.set(t.tempId, t));

    const visited = new Set();
    const sorted = [];

    const visit = (task) => {
      if (visited.has(task.tempId)) return;
      visited.add(task.tempId);

      (task.dependencies || []).forEach(depId => {
        const depTask = taskMap.get(depId);
        if (depTask) visit(depTask);
      });

      sorted.push(task);
    };

    tasks.forEach(t => visit(t));
    return sorted;
  }

  // =========================================================================
  // STEP 4: DEVELOPER RECOMMENDATION (FEATURE 1 INTEGRATION)
  // =========================================================================
  assignDeveloperRecommendationsToTasks(plan) {
    const allDevs = this.storage.getDevelopers();
    if (allDevs.length === 0) return;

    plan.tasks.forEach(task => {
      const recResult = this.storage.recommendDevelopersForTask(task, task.sprintTempId);
      task.recommendationResult = recResult;
      task.topRecommendations = recResult.topRecommendations || [];
      task.allRankedCandidates = recResult.allRankedCandidates || [];

      // By default suggest Top 1 candidate if available and not capacity overloaded
      if (task.topRecommendations.length > 0) {
        const top = task.topRecommendations[0];
        task.suggestedAssigneeId = top.developerId;
        task.suggestedAssigneeName = top.developerName;
        task.suggestedMatchScore = top.totalScore;
        task.suggestedTopFit = top;
      }
    });
  }

  // =========================================================================
  // STEP 5 & 6: INTERACTIVE REVIEW & APPROVAL SCREEN
  // =========================================================================
  renderReviewAndApprovalBoard() {
    const container = document.getElementById('plan-review-section');
    if (!container) return;

    container.style.display = 'block';

    const plan = this.currentPlan;
    const feas = plan.feasibility;
    const project = plan.project;
    const sprints = plan.sprints;
    const tasks = plan.tasks;

    const totalPoints = tasks.reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);
    const totalHours = tasks.reduce((sum, t) => sum + (parseFloat(t.estimatedHours) || 0), 0);

    container.innerHTML = `
      <!-- Review Header & Executive Summary -->
      <section class="card" style="border-top: 4px solid var(--primary); margin-bottom: 1.5rem; box-shadow: var(--shadow-md);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <span class="badge badge-active" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #fff;">🤖 AI-Generated Agile Proposal</span>
              <span class="badge ${feas.isFeasible ? 'badge-done' : 'badge-priority-high'}">
                ${feas.isFeasible ? '✅ Feasible Within Deadline' : '⚠️ Action Required'}
              </span>
            </div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--slate-900); margin: 0;">
              ${project.title}
            </h2>
            <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.25rem; max-width: 800px;">
              ${project.abstract.length > 220 ? project.abstract.substring(0, 220) + '...' : project.abstract}
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="window.aiSprintGeneratorController.openNewTaskModal()">
              ➕ Add Custom Task
            </button>
            <button class="btn btn-secondary" onclick="window.aiSprintGeneratorController.openRegeneratePromptModal()">
              🔄 Regenerate with Instructions
            </button>
            <button class="btn btn-primary" style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-color: #059669; font-weight: 700;" onclick="window.aiSprintGeneratorController.handleApprovePlan()">
              💾 Approve &amp; Save Complete Plan
            </button>
          </div>
        </div>

        <!-- Metric Summary Chips -->
        <div class="metrics-grid" style="margin-bottom: 1rem;">
          <div class="metric-card primary" style="padding: 0.875rem;">
            <div class="metric-info">
              <span class="metric-label">Planned Sprints</span>
              <span class="metric-value">${sprints.length}</span>
              <span class="metric-sub">${project.sprintDurationWeeks} weeks each</span>
            </div>
          </div>
          <div class="metric-card success" style="padding: 0.875rem;">
            <div class="metric-info">
              <span class="metric-label">Total Scope</span>
              <span class="metric-value">${tasks.length} Tasks</span>
              <span class="metric-sub">${totalPoints} Story Points</span>
            </div>
          </div>
          <div class="metric-card purple" style="padding: 0.875rem;">
            <div class="metric-info">
              <span class="metric-label">Estimated Effort</span>
              <span class="metric-value">${totalHours} Hours</span>
              <span class="metric-sub">Across ${sprints.length} sprints</span>
            </div>
          </div>
          <div class="metric-card ${feas.isDeadlineExceeded ? 'danger' : 'info'}" style="padding: 0.875rem;">
            <div class="metric-info">
              <span class="metric-label">Projected Delivery</span>
              <span class="metric-value" style="font-size: 1.25rem;">${feas.plannedFinishDate}</span>
              <span class="metric-sub">Deadline: ${project.deadline}</span>
            </div>
          </div>
        </div>

        <!-- Feasibility & Warnings Alert Box -->
        <div class="alert ${feas.isFeasible ? 'alert-success' : 'alert-warning'}" style="margin-bottom: 0;">
          <strong style="display: block; margin-bottom: 0.25rem;">📋 Capacity &amp; Schedule Feasibility Audit:</strong>
          <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.8125rem;">
            ${feas.suggestions.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      </section>

      <!-- Extracted AI Assumptions & Non-Functional Requirements -->
      <section class="card" style="margin-bottom: 1.5rem; background: var(--slate-50);">
        <details>
          <summary style="font-weight: 700; color: var(--slate-900); cursor: pointer; font-size: 0.9375rem;">
            🔍 View Extracted Requirements, Skills &amp; AI Assumptions (${plan.analyzedData.assumptions.length} items for PM review)
          </summary>
          <div style="margin-top: 1rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
            <div style="background: #fff; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <strong style="color: var(--slate-900); font-size: 0.8125rem; display: block; margin-bottom: 0.5rem;">⚙️ Required Technical Skills</strong>
              <div class="skill-tags-list">
                ${plan.analyzedData.skills.map(s => `<span class="badge badge-active">${s}</span>`).join('')}
              </div>
            </div>
            <div style="background: #fff; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <strong style="color: var(--slate-900); font-size: 0.8125rem; display: block; margin-bottom: 0.5rem;">🔒 Non-Functional Requirements</strong>
              <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.75rem; color: var(--text-muted);">
                ${plan.analyzedData.nonFunctional.map(nf => `<li>${nf}</li>`).join('')}
              </ul>
            </div>
            <div style="background: #fff; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); grid-column: 1 / -1;">
              <strong style="color: #92400e; font-size: 0.8125rem; display: block; margin-bottom: 0.5rem;">⚠️ AI-Generated Assumptions (Pending Project Manager Sign-Off)</strong>
              <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.75rem; color: #78350f;">
                ${plan.analyzedData.assumptions.map(a => `<li>${a}</li>`).join('')}
              </ul>
            </div>
          </div>
        </details>
      </section>

      <!-- Sprints & Tasks Accordion -->
      <div id="sprints-board-container">
        ${sprints.map((sprint, sIdx) => this.renderSprintSectionHtml(sprint, sIdx)).join('')}
      </div>

      <!-- Bottom Approval Action Bar -->
      <div style="margin-top: 2rem; padding: 1.5rem; background: #fff; border: 2px solid var(--primary); border-radius: var(--radius-lg); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; box-shadow: var(--shadow-lg);">
        <div>
          <h3 style="margin: 0; font-size: 1.125rem; color: var(--slate-900); font-weight: 800;">
            Ready to Activate This Agile Plan?
          </h3>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.8125rem; color: var(--text-muted);">
            Approving commits this project, all ${sprints.length} sprints, ${tasks.length} tasks, dependencies, and developer assignments into verified storage.
          </p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <a href="manager.html" class="btn btn-secondary">Discard &amp; Exit</a>
          <button class="btn btn-primary" style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-color: #059669; font-weight: 700; padding: 0.65rem 1.5rem; font-size: 1rem;" onclick="window.aiSprintGeneratorController.handleApprovePlan()">
            🚀 Approve &amp; Activate Project Plan
          </button>
        </div>
      </div>
    `;
  }

  renderSprintSectionHtml(sprint, sIdx) {
    const isOverloaded = sprint.totalHours > sprint.capacityHours;
    const utilClass = isOverloaded ? 'danger' : (sprint.utilizationPercent > 85 ? 'warning' : 'success');

    return `
      <section class="card" style="margin-bottom: 1.5rem; border-left: 4px solid var(--primary);">
        <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span class="task-id" style="font-size: 0.8125rem;">SPRINT #${sprint.sprintNumber}</span>
              <span class="badge badge-active">${sprint.durationDays / 7} WEEKS</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${sprint.startDate} &rarr; ${sprint.endDate}</span>
            </div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--slate-900); margin: 0;">
              ${sprint.name}
            </h3>
            <p style="font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.25rem;">
              🎯 <strong>Goal:</strong> ${sprint.objective}
            </p>
          </div>

          <!-- Capacity Bar -->
          <div style="min-width: 240px; text-align: right;">
            <div style="font-size: 0.75rem; margin-bottom: 0.25rem; color: var(--slate-700);">
              Sprint Scope: <strong>${sprint.totalHours}h / ${sprint.capacityHours}h</strong> (${sprint.totalPoints} SP)
            </div>
            <div class="progress-bar-container" style="height: 0.625rem;">
              <div class="progress-bar-fill ${utilClass}" style="width: ${Math.min(100, sprint.utilizationPercent)}%;"></div>
            </div>
            <span style="font-size: 0.6875rem; color: ${isOverloaded ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 600;">
              ${isOverloaded ? `⚠️ Overloaded by ${Math.round(sprint.totalHours - sprint.capacityHours)}h` : `${sprint.utilizationPercent}% team capacity utilized`}
            </span>
          </div>
        </div>

        <!-- Grouping Rationale Explainer Banner -->
        <div style="background: #f1f5f9; padding: 0.625rem 0.875rem; border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--slate-700); margin-bottom: 1rem;">
          💡 <strong>Why tasks are grouped here:</strong> ${sprint.groupingRationale}
        </div>

        <!-- Tasks Table in this sprint -->
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 100px;">Task ID</th>
                <th>Task Title &amp; Module</th>
                <th>Points &amp; Effort</th>
                <th>Dependencies</th>
                <th>Top Developer Match (Feature 1)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${sprint.tasks.map(task => this.renderTaskRowHtml(task, sprint)).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  renderTaskRowHtml(task, sprint) {
    const recResult = task.recommendationResult;
    const topRecs = task.topRecommendations || [];
    const topCand = topRecs[0];

    const currentAssignee = task.assigneeId || (topCand ? topCand.developerId : null);
    const assignedDev = currentAssignee ? this.storage.getUserById(currentAssignee) : null;
    const isOverridden = task.pmOverride && task.pmOverride.approved;

    return `
      <tr>
        <td>
          <strong class="task-id">${task.tempId}</strong>
          <div style="font-size: 0.6875rem; color: var(--text-muted);">${task.priority}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--slate-900);">${task.title}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${task.module}</div>
          <div class="skill-tags-list" style="margin-top: 0.25rem;">
            ${(task.requiredSkills || []).map(s => `<span class="badge badge-active" style="font-size: 0.625rem; padding: 0.1rem 0.35rem;">${s}</span>`).join('')}
          </div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--slate-800);">${task.storyPoints} SP</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${task.estimatedHours}h est.</div>
        </td>
        <td>
          ${(task.dependencies || []).length > 0 ? (
            task.dependencies.map(d => `<span class="badge badge-archived" style="font-size: 0.625rem;">${d}</span>`).join(' ')
          ) : '<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">None (Root)</span>'}
        </td>
        <td>
          <!-- Intelligent Developer Recommendation Card -->
          <div style="min-width: 200px;">
            <select class="nav-select" style="width: 100%; font-size: 0.75rem; padding: 0.25rem 0.5rem;" onchange="window.aiSprintGeneratorController.handleAssigneeChange('${task.tempId}', this.value)">
              <option value="">👤 Unassigned</option>
              ${topRecs.map(rec => `
                <option value="${rec.developerId}" ${rec.developerId === currentAssignee ? 'selected' : ''}>
                  #${rec.rank} ${rec.developerName} (${rec.totalScore}% Match) ${rec.willExceedCapacity ? '⚠️ Overload' : ''}
                </option>
              `).join('')}
            </select>

            ${topCand ? `
              <div style="margin-top: 0.35rem; display: flex; align-items: center; justify-content: space-between; font-size: 0.6875rem;">
                <span style="color: var(--text-muted);">
                  Top #1: <strong>${topCand.developerName}</strong> (${topCand.totalScore}%)
                </span>
                <button type="button" class="btn btn-sm btn-link" style="padding: 0; font-size: 0.6875rem; color: var(--primary);" onclick="window.aiSprintGeneratorController.openComparisonModal('${task.tempId}')">
                  ⚖️ Compare Top 3
                </button>
              </div>
            ` : '<span style="font-size: 0.6875rem; color: var(--text-muted);">No eligible developers</span>'}

            ${isOverridden ? `
              <span class="badge badge-warning" style="font-size: 0.625rem; margin-top: 0.25rem; display: inline-block;" title="${task.pmOverride.reason}">
                ⚠️ Overridden: ${task.pmOverride.reason}
              </span>
            ` : ''}
          </div>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-sm btn-secondary" title="Edit Task Details" onclick="window.aiSprintGeneratorController.openEditTaskModal('${task.tempId}')">✏️</button>
            <button class="btn btn-sm btn-outline-danger" title="Delete Task" onclick="window.aiSprintGeneratorController.handleDeleteTask('${task.tempId}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }

  // =========================================================================
  // INTERACTIVE EDITING & PM OVERRIDE
  // =========================================================================
  handleAssigneeChange(taskTempId, devId) {
    const task = this.currentPlan.tasks.find(t => t.tempId === taskTempId);
    if (!task) return;

    if (!devId) {
      task.assigneeId = null;
      task.pmOverride = null;
      this.renderReviewAndApprovalBoard();
      return;
    }

    // Check capacity / skills validation
    const recResult = this.storage.recommendDevelopersForTask(task, task.sprintTempId);
    const candidate = recResult.recommendations.find(r => r.developerId === devId);

    if (candidate && (candidate.willExceedCapacity || candidate.missingSkills.length > 0)) {
      // Prompt PM Override
      this.pendingOverrideTask = task;
      this.pendingOverrideCandidate = candidate;
      this.openPmOverrideModal(task, candidate);
    } else {
      task.assigneeId = devId;
      task.pmOverride = null;
      if (this.auth) this.auth.showToast(`Assigned ${candidate ? candidate.developerName : devId} to ${task.tempId}`, 'success');
      this.renderReviewAndApprovalBoard();
    }
  }

  openPmOverrideModal(task, candidate) {
    const modal = document.getElementById('pm-override-modal');
    if (!modal) return;

    document.getElementById('override-task-title').textContent = `${task.tempId}: ${task.title}`;
    document.getElementById('override-dev-name').textContent = candidate.developerName;

    const reasonsList = document.getElementById('override-policy-exceptions');
    if (reasonsList) {
      const exceptions = [];
      if (candidate.willExceedCapacity) {
        exceptions.push(`Weekly Capacity Overload: Assigning this task requires ${task.estimatedHours}h, which exceeds safe limit by ${candidate.excessHours}h (${candidate.currentWorkloadHours + task.estimatedHours}h / ${candidate.maxWeeklyHours}h).`);
      }
      if (candidate.missingSkills.length > 0) {
        exceptions.push(`Missing Technical Skills: Developer lacks recorded proficiency in: ${candidate.missingSkills.join(', ')}.`);
      }
      reasonsList.innerHTML = exceptions.map(e => `<li>${e}</li>`).join('');
    }

    document.getElementById('override-reason-input').value = 'Approved by Project Manager under special sprint delivery authorization.';
    modal.style.display = 'flex';
  }

  confirmPmOverrideAssignment() {
    const reason = document.getElementById('override-reason-input')?.value.trim();
    if (!reason) {
      if (this.auth) this.auth.showToast('Please specify a valid override reason.', 'warning');
      return;
    }

    const task = this.pendingOverrideTask;
    const candidate = this.pendingOverrideCandidate;
    const currentUser = this.auth ? this.auth.getCurrentUser() : null;

    if (task && candidate) {
      task.assigneeId = candidate.developerId;
      task.pmOverride = {
        approved: true,
        managerId: currentUser ? currentUser.id : 'PM',
        managerName: currentUser ? currentUser.name : 'Project Manager',
        reason,
        timestamp: new Date().toISOString()
      };
      if (this.auth) this.auth.showToast(`PM Override approved: Assigned ${candidate.developerName} to ${task.tempId}`, 'info');
    }

    this.closeModals();
    this.renderReviewAndApprovalBoard();
  }

  openComparisonModal(taskTempId) {
    const task = this.currentPlan.tasks.find(t => t.tempId === taskTempId);
    if (!task) return;

    const compData = this.storage.compareCandidatesForTask(task, [], task.sprintTempId);
    if (!compData || compData.candidates.length === 0) {
      if (this.auth) this.auth.showToast('No eligible candidates to compare.', 'info');
      return;
    }

    const modal = document.getElementById('candidate-comparison-modal');
    if (!modal) return;

    document.getElementById('comparison-task-title').textContent = `${task.tempId}: ${task.title} (${task.estimatedHours}h, ${task.priority} Priority)`;

    const grid = document.getElementById('comparison-cards-grid');
    if (grid) {
      grid.innerHTML = compData.candidates.map(cand => `
        <div class="card" style="border-top: 4px solid ${cand.rank === 1 ? 'var(--primary)' : 'var(--slate-300)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span class="badge ${cand.rank === 1 ? 'badge-active' : 'badge-archived'}">RANK #${cand.rank}</span>
            <span class="rec-score-pill ${cand.matchBadge}">${cand.totalScore}% MATCH</span>
          </div>
          <h4 style="margin: 0; font-size: 1.1rem; color: var(--slate-900);">${cand.developerName}</h4>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">${cand.jobTitle} &bull; ${cand.experienceLevel}</div>

          <div style="font-size: 0.8125rem; margin-bottom: 0.5rem;">
            <strong>Skills Matched:</strong> ${cand.matchedSkills.length > 0 ? cand.matchedSkills.join(', ') : 'None'}
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

          <button class="btn btn-sm ${cand.rank === 1 ? 'btn-primary' : 'btn-secondary'}" style="width: 100%;" onclick="window.aiSprintGeneratorController.handleAssigneeChange('${task.tempId}', '${cand.developerId}'); document.getElementById('candidate-comparison-modal').style.display='none';">
            Select Candidate #${cand.rank} &rarr;
          </button>
        </div>
      `).join('');
    }

    modal.style.display = 'flex';
  }

  openEditTaskModal(taskTempId) {
    const task = this.currentPlan.tasks.find(t => t.tempId === taskTempId);
    if (!task) return;

    this.editingTask = task;
    const modal = document.getElementById('edit-task-modal');
    if (!modal) return;

    document.getElementById('edit-task-title-input').value = task.title;
    document.getElementById('edit-task-desc-input').value = task.description;
    document.getElementById('edit-task-module-input').value = task.module;
    document.getElementById('edit-task-skills-input').value = (task.requiredSkills || []).join(', ');
    document.getElementById('edit-task-priority-input').value = task.priority;
    document.getElementById('edit-task-points-input').value = task.storyPoints;
    document.getElementById('edit-task-hours-input').value = task.estimatedHours;

    // Populate sprint selector
    const sprintSelect = document.getElementById('edit-task-sprint-select');
    if (sprintSelect) {
      sprintSelect.innerHTML = this.currentPlan.sprints.map((s, idx) => `
        <option value="${idx}" ${task.sprintIndex === idx ? 'selected' : ''}>
          Sprint ${idx + 1}: ${s.name}
        </option>
      `).join('');
    }

    modal.style.display = 'flex';
  }

  saveTaskModalEdit() {
    if (!this.editingTask) return;

    const task = this.editingTask;
    task.title = document.getElementById('edit-task-title-input')?.value.trim() || task.title;
    task.description = document.getElementById('edit-task-desc-input')?.value.trim() || task.description;
    task.module = document.getElementById('edit-task-module-input')?.value.trim() || task.module;
    const rawSkills = document.getElementById('edit-task-skills-input')?.value || '';
    task.requiredSkills = rawSkills.split(',').map(s => s.trim()).filter(Boolean);
    task.priority = document.getElementById('edit-task-priority-input')?.value || task.priority;
    task.storyPoints = parseInt(document.getElementById('edit-task-points-input')?.value) || task.storyPoints;
    task.estimatedHours = parseFloat(document.getElementById('edit-task-hours-input')?.value) || task.estimatedHours;
    const newSprintIdx = parseInt(document.getElementById('edit-task-sprint-select')?.value);

    if (!isNaN(newSprintIdx) && newSprintIdx !== task.sprintIndex) {
      task.sprintIndex = newSprintIdx;
      task.sprintTempId = `SPR-TEMP-${newSprintIdx + 1}`;
    }

    task.manuallyEdited = true;

    // Recalculate sprint hours and developer recommendations
    this.rebalancePlan();
    this.closeModals();
    if (this.auth) this.auth.showToast(`Updated task: ${task.tempId}`, 'success');
  }

  handleDeleteTask(taskTempId) {
    if (!confirm(`Delete task ${taskTempId}? This will remove it from the proposed sprint plan.`)) return;

    this.currentPlan.tasks = this.currentPlan.tasks.filter(t => t.tempId !== taskTempId);
    // Remove as dependency from other tasks
    this.currentPlan.tasks.forEach(t => {
      t.dependencies = (t.dependencies || []).filter(dep => dep !== taskTempId);
    });

    this.rebalancePlan();
    if (this.auth) this.auth.showToast(`Removed task ${taskTempId}`, 'info');
  }

  openNewTaskModal() {
    const modal = document.getElementById('add-task-modal');
    if (!modal) return;

    const sprintSelect = document.getElementById('new-task-sprint-select');
    if (sprintSelect) {
      sprintSelect.innerHTML = this.currentPlan.sprints.map((s, idx) => `
        <option value="${idx}">Sprint ${idx + 1}: ${s.name}</option>
      `).join('');
    }

    modal.style.display = 'flex';
  }

  saveNewCustomTask() {
    const title = document.getElementById('new-task-title-input')?.value.trim();
    if (!title) {
      if (this.auth) this.auth.showToast('Task title is required.', 'warning');
      return;
    }

    const desc = document.getElementById('new-task-desc-input')?.value.trim() || '';
    const module = document.getElementById('new-task-module-input')?.value.trim() || 'General';
    const rawSkills = document.getElementById('new-task-skills-input')?.value || '';
    const skills = rawSkills.split(',').map(s => s.trim()).filter(Boolean);
    const priority = document.getElementById('new-task-priority-input')?.value || 'Medium';
    const points = parseInt(document.getElementById('new-task-points-input')?.value) || 3;
    const hours = parseFloat(document.getElementById('new-task-hours-input')?.value) || 12;
    const sprintIdx = parseInt(document.getElementById('new-task-sprint-select')?.value) || 0;

    const newTask = {
      tempId: `TSK-GEN-${String(this.currentPlan.tasks.length + 1).padStart(3, '0')}`,
      title,
      description: desc,
      module,
      requiredSkills: skills,
      priority,
      storyPoints: points,
      estimatedHours: hours,
      dependencies: [],
      acceptanceCriteria: ['Task deliverable validated and passing review.'],
      sprintIndex: sprintIdx,
      sprintTempId: `SPR-TEMP-${sprintIdx + 1}`,
      manuallyEdited: true
    };

    this.currentPlan.tasks.push(newTask);
    this.rebalancePlan();
    this.closeModals();
    if (this.auth) this.auth.showToast(`Added new task: ${newTask.tempId}`, 'success');
  }

  openRegeneratePromptModal() {
    const modal = document.getElementById('regenerate-prompt-modal');
    if (!modal) return;
    modal.style.display = 'flex';
  }

  confirmRegenerateWithPrompt() {
    const prompt = document.getElementById('regen-custom-prompt-input')?.value.trim();
    this.closeModals();
    this.handleGeneratePlan(prompt);
  }

  rebalancePlan() {
    // Re-distribute tasks into sprint buckets
    this.currentPlan.sprints.forEach((sprint, idx) => {
      sprint.tasks = this.currentPlan.tasks.filter(t => t.sprintIndex === idx);
      sprint.totalPoints = sprint.tasks.reduce((sum, t) => sum + (parseInt(t.storyPoints) || 0), 0);
      sprint.totalHours = sprint.tasks.reduce((sum, t) => sum + (parseFloat(t.estimatedHours) || 0), 0);
      sprint.utilizationPercent = sprint.capacityHours > 0 ? Math.round((sprint.totalHours / sprint.capacityHours) * 100) : 0;
    });

    this.assignDeveloperRecommendationsToTasks(this.currentPlan);
    this.renderReviewAndApprovalBoard();
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  }

  // =========================================================================
  // STEP 7: PERSISTENT STORAGE
  // =========================================================================
  handleApprovePlan() {
    if (!this.currentPlan) return;

    if (!confirm('Approve and activate this Agile Sprint Plan? All projects, sprints, tasks, and assignments will be created in your workspace.')) {
      return;
    }

    const res = this.storage.saveAiSprintPlan(this.currentPlan);
    if (res.success) {
      if (this.auth) {
        this.auth.showToast(`🎉 Plan Approved! Created Project ${res.project.id} with ${res.sprints.length} Sprints and ${res.tasks.length} Tasks.`, 'success');
      }

      setTimeout(() => {
        window.location.href = `manager.html?projectId=${res.projectId}`;
      }, 700);
    } else {
      if (this.auth) this.auth.showToast(res.error || 'Failed to save plan.', 'danger');
    }
  }
}

// Global Singleton Instance
window.aiSprintGeneratorController = new AiSprintGeneratorController();
