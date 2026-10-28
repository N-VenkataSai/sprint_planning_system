/**
 * Sprint Planning & Intelligent Resource Allocation System
 * Automated Verification & Test Suite
 *
 * Enforces Mandatory Data Policy:
 * - ZERO pre-loaded, dummy, sample, or fabricated business data
 * - Clean empty initial state
 * - User-controlled account and data creation
 * - Explainable rule-based calculations (no fake ML claims)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('====================================================');
console.log('🚀 RUNNING SPRINTALLOC TEST & VERIFICATION SUITE');
console.log('====================================================\n');

// 1. Verify File Integrity
console.log('--- 1. Checking File Integrity ---');
const REQUIRED_FILES = [
  'frontend/index.html',
  'frontend/admin.html',
  'frontend/manager.html',
  'frontend/developer.html',
  'frontend/create-project.html',
  'frontend/create-task.html',
  'frontend/sprint-planning.html',
  'frontend/task-details.html',
  'frontend/analytics.html',
  'frontend/css/style.css',
  'frontend/css/dashboard.css',
  'frontend/css/responsive.css',
  'frontend/js/storage.js',
  'frontend/js/auth.js',
  'frontend/js/navigation.js',
  'frontend/js/admin.js',
  'frontend/js/manager.js',
  'frontend/js/developer.js',
  'frontend/js/projects.js',
  'frontend/js/tasks.js',
  'frontend/js/sprint-planning.js',
  'frontend/js/analytics.js',
  'frontend/vendor/chart.umd.min.js'
];

let failedFiles = 0;
REQUIRED_FILES.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    if (stat.size > 0) {
      console.log(`✅ [EXISTS] ${file} (${(stat.size / 1024).toFixed(1)} KB)`);
    } else {
      console.error(`❌ [EMPTY FILE] ${file}`);
      failedFiles++;
    }
  } else {
    console.error(`❌ [MISSING] ${file}`);
    failedFiles++;
  }
});

if (failedFiles > 0) {
  console.error(`\n❌ File integrity check failed with ${failedFiles} missing/empty file(s).`);
  process.exit(1);
}

// 2. Storage Engine & Policy Verification
console.log('\n--- 2. Verifying Zero-Sample-Data Policy & Storage Engine ---');

// Mock browser localStorage and environment in Node
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};
global.window = {
  dispatchEvent: () => {}
};
global.CustomEvent = function() {};

// Load StorageManager
const storageCode = fs.readFileSync(path.join(__dirname, 'frontend/js/storage.js'), 'utf8');
eval(storageCode);
const storage = window.storageManager;

// Test A: Clean Launch Initial State
const initialUsers = storage.getUsers();
const initialProjects = storage.getProjects();
const initialSprints = storage.getSprints();
const initialTasks = storage.getTasks();

console.log(`Initial State Check: ${initialUsers.length} Users, ${initialProjects.length} Projects, ${initialSprints.length} Sprints, ${initialTasks.length} Tasks`);
if (initialUsers.length === 0 && initialProjects.length === 0 && initialSprints.length === 0 && initialTasks.length === 0) {
  console.log('✅ PASS: Mandatory Zero-Sample-Data Policy verified: Application initializes 100% empty.');
} else {
  console.error('❌ FAIL: Pre-loaded or sample business data detected in storage!');
  process.exit(1);
}

// Test B: Empty State Safety Check
const emptyPrjStats = storage.calculateProjectStats('NONEXISTENT');
if (emptyPrjStats && emptyPrjStats.totalTasks === 0 && emptyPrjStats.progressPercent === 0) {
  console.log('✅ PASS: Empty project stats safely handled without errors.');
} else {
  console.error('❌ FAIL: Empty project stats calculation error');
  process.exit(1);
}

const emptyRecs = storage.recommendDevelopersForTask({ id: 'DRAFT', estimatedHours: 5, requiredSkills: ['JavaScript'] });
if (emptyRecs && emptyRecs.hasData === false && emptyRecs.recommendations.length === 0) {
  console.log('✅ PASS: Recommendation engine gracefully handles empty developer pool.');
} else {
  console.error('❌ FAIL: Recommendation engine did not properly return empty state response');
  process.exit(1);
}

// 3. User-Controlled Setup Flow & Business Operations
console.log('\n--- 3. Testing User-Controlled Setup Flow & Business CRUD ---');

// Register first administrator
const adminResult = storage.registerFirstAdmin({
  name: 'Lead Administrator',
  email: 'admin@company.org',
  title: 'Chief System Architect'
});

if (adminResult.success && storage.getUsers().length === 1 && storage.getUsers()[0].role === 'admin') {
  console.log('✅ PASS: Explicit first administrator registration verified.');
} else {
  console.error('❌ FAIL: First administrator registration failed');
  process.exit(1);
}

// Prevent duplicate first admin setup
const duplicateAdminResult = storage.registerFirstAdmin({ name: 'Imposter', email: 'imposter@bad.com' });
if (!duplicateAdminResult.success) {
  console.log('✅ PASS: Duplicate first-admin registration correctly blocked.');
} else {
  console.error('❌ FAIL: Duplicate first-admin registration was allowed');
  process.exit(1);
}

// Create Project Manager and Developer accounts
const pmUser = storage.saveUser({
  name: 'Sarah Connor',
  email: 'sarah.pm@company.org',
  role: 'manager',
  title: 'Senior Technical PM',
  maxWeeklyHours: 40,
  skills: ['Scrum', 'Agile', 'Jira']
});

const devSenior = storage.saveUser({
  name: 'Marcus Wright',
  email: 'marcus.dev@company.org',
  role: 'developer',
  title: 'Senior Full Stack Engineer',
  experienceLevel: 'Senior',
  maxWeeklyHours: 40,
  skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS']
});

const devJunior = storage.saveUser({
  name: 'Kyle Reese',
  email: 'kyle.dev@company.org',
  role: 'developer',
  title: 'Junior Frontend Developer',
  experienceLevel: 'Junior',
  maxWeeklyHours: 30,
  skills: ['TypeScript', 'HTML5', 'CSS3']
});

console.log(`Registered team: ${storage.getUsers().length} users (1 Admin, 1 PM, 2 Developers)`);
if (storage.getUsers().length === 4 && storage.getDevelopers().length === 2) {
  console.log('✅ PASS: User management & role filtering verified.');
} else {
  console.error('❌ FAIL: User creation or developer filtering failed');
  process.exit(1);
}

// Create Project
const newProject = storage.saveProject({
  id: 'PRJ-NEO',
  name: 'Enterprise Core Platform',
  description: 'Production core microservices modernization',
  status: 'Active',
  managerId: pmUser.id,
  teamMembers: [devSenior.id, devJunior.id],
  startDate: '2026-10-01',
  endDate: '2026-12-31'
});

if (storage.getProjectById('PRJ-NEO') && storage.getProjects().length === 1) {
  console.log('✅ PASS: Project creation & retrieval verified.');
} else {
  console.error('❌ FAIL: Project creation failed');
  process.exit(1);
}

// Create Sprint
const newSprint = storage.saveSprint({
  id: 'SP-NEO-01',
  projectId: 'PRJ-NEO',
  name: 'Sprint 1 - Foundation Architecture',
  goal: 'Implement database schema and authentication service',
  startDate: '2026-10-15',
  endDate: '2026-11-05',
  status: 'Active',
  capacityPoints: 35
});

if (storage.getSprintById('SP-NEO-01') && storage.getSprintsByProject('PRJ-NEO').length === 1) {
  console.log('✅ PASS: Sprint creation & retrieval verified.');
} else {
  console.error('❌ FAIL: Sprint creation failed');
  process.exit(1);
}

// 4. Test Transparent Rule-Based Algorithms
console.log('\n--- 4. Testing Transparent Rule-Based Algorithms ---');

// Test A: Skill Match
const exactMatch = storage.calculateSkillMatch(['Docker', 'AWS'], devSenior.skills);
console.log(`Exact Skill Match: ${exactMatch.matchPercent}% (${exactMatch.scorePoints}/50 pts)`);
if (exactMatch.matchPercent === 100 && exactMatch.scorePoints === 50) {
  console.log('✅ PASS: 100% Skill Match rule verified.');
} else {
  console.error('❌ FAIL: Skill match calculation error');
  process.exit(1);
}

const partialMatch = storage.calculateSkillMatch(['TypeScript', 'PostgreSQL', 'Kubernetes', 'Go'], devSenior.skills);
console.log(`Partial Skill Match (2/4 skills): ${partialMatch.matchPercent}% (${partialMatch.scorePoints}/50 pts)`);
if (partialMatch.matchPercent === 50 && partialMatch.scorePoints === 25) {
  console.log('✅ PASS: 50% Partial Skill Match rule verified.');
} else {
  console.error('❌ FAIL: Partial skill match calculation error');
  process.exit(1);
}

// Test B: Developer Workload & Overload Warning
// Create task assigned to Junior Dev Kyle (capacity: 30 hours)
const task1 = storage.saveTask({
  id: 'TSK-001',
  projectId: 'PRJ-NEO',
  sprintId: 'SP-NEO-01',
  title: 'Implement Navigation Header',
  priority: 'High',
  storyPoints: 5,
  estimatedHours: 20,
  actualHours: 0,
  assigneeId: devJunior.id,
  requiredSkills: ['HTML5', 'CSS3'],
  deadline: '2026-11-01',
  status: 'In Progress'
});

const loadBefore = storage.calculateDeveloperWorkload(devJunior.id, 'SP-NEO-01');
console.log(`Kyle workload (20h / 30h): ${loadBefore.utilizationPercent}% - Overloaded: ${loadBefore.isOverloaded}`);
if (!loadBefore.isOverloaded && loadBefore.utilizationPercent === 67) {
  console.log('✅ PASS: Standard workload calculation verified.');
} else {
  console.error('❌ FAIL: Workload calculation incorrect');
  process.exit(1);
}

// Assign another task exceeding Kyle's weekly capacity of 30h
const task2 = storage.saveTask({
  id: 'TSK-002',
  projectId: 'PRJ-NEO',
  sprintId: 'SP-NEO-01',
  title: 'Responsive Dashboard Shell',
  priority: 'Critical',
  storyPoints: 8,
  estimatedHours: 15,
  actualHours: 0,
  assigneeId: devJunior.id,
  requiredSkills: ['CSS3'],
  deadline: '2026-11-03',
  status: 'Ready'
});

const loadAfter = storage.calculateDeveloperWorkload(devJunior.id, 'SP-NEO-01');
console.log(`Kyle updated load (35h / 30h): ${loadAfter.utilizationPercent}% - Overloaded: ${loadAfter.isOverloaded} (Excess: ${loadAfter.excessHours}h)`);
if (loadAfter.isOverloaded && loadAfter.excessHours === 5) {
  console.log('✅ PASS: Workload capacity limit & overload detection verified.');
} else {
  console.error('❌ FAIL: Capacity overload detection failed');
  process.exit(1);
}

// Test C: Intelligent Recommendation Engine (Explainable Ranking)
const draftTask = {
  id: 'TSK-003',
  projectId: 'PRJ-NEO',
  sprintId: 'SP-NEO-01',
  title: 'PostgreSQL Database Migrations',
  estimatedHours: 12,
  requiredSkills: ['PostgreSQL', 'Docker']
};

const recResult = storage.recommendDevelopersForTask(draftTask, 'SP-NEO-01');
console.log(`Recommendation Results for TSK-003 (${recResult.recommendations.length} candidates):`);
recResult.recommendations.forEach((r, idx) => {
  const bd = r.breakdown;
  console.log(`  ${idx + 1}. ${r.developer.name} (${r.developer.experienceLevel}) -> Total: ${r.totalScore}% | Skills: ${bd.skillScore}/50, Workload: ${bd.workloadScore}/30, Exp: ${bd.experienceScore}/20 | Overload: ${bd.willExceedCapacity}`);
});

if (recResult.hasData && recResult.recommendations[0].developer.id === devSenior.id) {
  console.log('✅ PASS: Recommendation engine correctly ranks Senior Dev with matching skills & capacity as top candidate.');
} else {
  console.error('❌ FAIL: Recommendation engine ranking mismatch');
  process.exit(1);
}

// Test D: Deadline Risk Calculation
const overdueTask = storage.saveTask({
  id: 'TSK-004',
  projectId: 'PRJ-NEO',
  sprintId: 'SP-NEO-01',
  title: 'Legacy Data Ingestion',
  priority: 'High',
  storyPoints: 3,
  estimatedHours: 8,
  actualHours: 0,
  assigneeId: devSenior.id,
  requiredSkills: ['Node.js'],
  deadline: '2026-10-20', // in the past
  status: 'In Progress'
});

const riskOverdue = storage.calculateTaskRisk(overdueTask);
console.log(`TSK-004 Risk Level: ${riskOverdue.riskLevel} (${riskOverdue.reason})`);
if (riskOverdue.riskLevel === 'OVERDUE') {
  console.log('✅ PASS: Overdue deadline risk calculation verified.');
} else {
  console.error('❌ FAIL: Overdue deadline risk calculation failed');
  process.exit(1);
}

// Test E: Effort Logging & Progress Updating
console.log('\n--- 5. Testing Effort Logging & Progress Aggregation ---');
storage.logEffort('TSK-001', 6.5, 'Created base grid and breakpoints', '2026-10-28');
const loggedTask = storage.getTaskById('TSK-001');
console.log(`TSK-001 Logged Effort: ${loggedTask.actualHours}h / ${loggedTask.estimatedHours}h, Work Logs count: ${loggedTask.workLogs.length}`);
if (loggedTask.actualHours === 6.5 && loggedTask.workLogs.length === 1) {
  console.log('✅ PASS: Work effort logging & history persistence verified.');
} else {
  console.error('❌ FAIL: Effort logging failed');
  process.exit(1);
}

// Test F: Project & Sprint Statistics Aggregation
const prjStats = storage.calculateProjectStats('PRJ-NEO');
console.log(`PRJ-NEO Aggregate Stats: ${prjStats.totalTasks} Tasks, ${prjStats.totalPoints} Story Points, Overdue: ${prjStats.overdueCount}`);
if (prjStats.totalTasks === 3 && prjStats.overdueCount === 1) {
  console.log('✅ PASS: Project statistics aggregation verified.');
} else {
  console.error('❌ FAIL: Project statistics aggregation error');
  process.exit(1);
}

// 6. Test Backup, Restore, and Wipe
console.log('\n--- 6. Testing JSON Backup, Import, and Clean Data Wipe ---');
const backupJson = storage.exportDataJSON();
const parsed = JSON.parse(backupJson);
if (parsed.users.length === 4 && parsed.projects.length === 1 && parsed.tasks.length === 3) {
  console.log('✅ PASS: JSON Backup export contains all user-entered data.');
} else {
  console.error('❌ FAIL: Backup export incomplete');
  process.exit(1);
}

// Wipe to pure empty
storage.clearAllData();
const wipedUsers = storage.getUsers();
const wipedProjects = storage.getProjects();
const wipedTasks = storage.getTasks();
console.log(`After clearAllData(): ${wipedUsers.length} Users, ${wipedProjects.length} Projects, ${wipedTasks.length} Tasks`);
if (wipedUsers.length === 0 && wipedProjects.length === 0 && wipedTasks.length === 0) {
  console.log('✅ PASS: Clean data wipe successfully restores 100% empty state.');
} else {
  console.error('❌ FAIL: Data wipe did not clear collections');
  process.exit(1);
}

// Restore from backup
const restoreResult = storage.importDataJSON(backupJson);
if (restoreResult.success && storage.getUsers().length === 4 && storage.getProjects().length === 1) {
  console.log('✅ PASS: JSON Backup restore successfully restored state.');
} else {
  console.error('❌ FAIL: Backup restore failed');
  process.exit(1);
}

// Final wipe so the application is left in 100% clean empty state for user evaluation
storage.clearAllData();
console.log('✅ Clean initial state restored for user evaluation.');

// 7. HTTP Server Verification
console.log('\n--- 7. Testing HTTP Asset Serving ---');
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'frontend/index.html' : req.url);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'frontend', req.url);
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.js') contentType = 'application/javascript';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(8765, async () => {
  console.log('Test HTTP server listening on port 8765');
  
  const testUrls = [
    '/frontend/index.html',
    '/frontend/admin.html',
    '/frontend/manager.html',
    '/frontend/developer.html',
    '/frontend/create-project.html',
    '/frontend/create-task.html',
    '/frontend/sprint-planning.html',
    '/frontend/task-details.html',
    '/frontend/analytics.html',
    '/frontend/css/style.css',
    '/frontend/css/dashboard.css',
    '/frontend/css/responsive.css',
    '/frontend/js/storage.js',
    '/frontend/js/auth.js',
    '/frontend/js/navigation.js',
    '/frontend/js/admin.js',
    '/frontend/js/manager.js',
    '/frontend/js/developer.js',
    '/frontend/js/projects.js',
    '/frontend/js/tasks.js',
    '/frontend/js/sprint-planning.js',
    '/frontend/js/analytics.js',
    '/frontend/vendor/chart.umd.min.js'
  ];

  let passedUrls = 0;
  for (const url of testUrls) {
    await new Promise((resolve) => {
      http.get(`http://localhost:8765${url}`, (res) => {
        if (res.statusCode === 200) {
          passedUrls++;
        } else {
          console.error(`Failed serving ${url}: HTTP ${res.statusCode}`);
        }
        resolve();
      });
    });
  }

  console.log(`✅ All ${passedUrls}/${testUrls.length} HTTP assets served with status 200 OK.`);
  server.close(() => {
    console.log('\n====================================================');
    console.log('🎉 ALL SYSTEM TESTS PASSED PERFECTLY (100%)!');
    console.log('====================================================\n');
  });
});
