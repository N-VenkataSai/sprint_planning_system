# Sprint Planning & Intelligent Resource Allocation System

A complete, fully functional, frontend-only agile project management and resource allocation web application built strictly with **HTML5, CSS3, Vanilla JavaScript, Chart.js**, and **Browser LocalStorage**.

> [!IMPORTANT]
> **Mandatory Zero-Sample-Data Policy**:
> This application adheres strictly to a zero-sample-data rule. No mock, seed, dummy, or fabricated business records exist in storage. On initial launch, all business collections (`projects`, `users`, `tasks`, `sprints`) are completely empty. All application data is entered and controlled directly by you.

---

## 🌟 Key Features

1. **Three Distinct Demonstration Roles:**
   - **👑 Administrator (`admin.html`)**: Complete enterprise governance, user account management (roles, skills, weekly capacity), system analytics, LocalStorage JSON backup/import, and data wipe.
   - **👔 Project Manager (`manager.html`)**: Project selection, sprint planning, task backlog management, intelligent developer recommendations, real-time workload balancing, and deadline risk monitoring.
   - **💻 Developer (`developer.html`)**: Personal task queue, required skill matching indicators, inline task status updates, actual effort hours logging, and weekly capacity gauge.

2. **First-Time Administrator Setup Flow:**
   - On initial launch with 0 users, `index.html` displays a secure, explicit **First Administrator Setup** form.
   - No hardcoded default credentials exist. The administrator account is created directly by you.

3. **Transparent, Explainable Rule Engines (No Fake ML Claims):**
   - **Developer Recommendation Engine**: Evaluates candidate developers based on explainable weighted scoring:
     - *Skill Match Score (0 - 50 pts)*: Direct ratio of required task skills possessed by the developer.
     - *Workload & Availability (0 - 30 pts)*: Based on current sprint load vs weekly capacity limit (0 pts + overload warning if capacity exceeded).
     - *Experience Level (0 - 20 pts)*: Senior (20 pts), Mid (15 pts), Junior (10 pts).
   - **Deadline Risk Scoring**:
     $$\text{Remaining Hours } (H_{\text{rem}}) = \max(0, \text{Estimated} - \text{Actual})$$
     $$\text{Available Capacity } (H_{\text{avail}}) = \text{Days Remaining} \times 6 \text{ hrs/day}$$
     - *Overdue*: Deadline date has already passed.
     - *High Risk*: $H_{\text{rem}} > H_{\text{avail}}$ (Required effort exceeds available working hours).
     - *Medium Risk*: $H_{\text{rem}} > 0.7 \times H_{\text{avail}}$ (Buffer is under 30%).
     - *Low Risk / On Track*: Sufficient buffer remains.
   - **Workload Balancing**: Real-time visual progress meters with warning flags when an assignment would exceed a developer's weekly capacity limit.

4. **Interactive Chart.js Visualizations (`analytics.html`):**
   - Sprint Velocity History (Planned Capacity vs Delivered Story Points)
   - Task Status Distribution (To Do, Ready, In Progress, Review, Done)
   - Developer Workload vs Capacity (Horizontal bar chart with overload warning thresholds)
   - Active Sprint Burndown Chart (Ideal linear burndown vs actual remaining points)
   - Skill Supply vs Backlog Demand
   - Deadline Risk Matrix
   - *Empty State Canvas Overlays*: When no data exists, charts clearly display "Insufficient data to render chart" overlays rather than fabricated values.

5. **100% Offline & Online Operation:**
   - Standalone Chart.js v4.6.1 bundled locally in `frontend/vendor/chart.umd.min.js`.
   - Automatic fallback to CDN if opened via external networks.
   - Fully client-side; zero external backend server dependencies.

---

## 📁 File Structure

```
project/
├── frontend/
│   ├── index.html            # Role portal, first-admin setup & project jumper
│   ├── admin.html            # Administrator control center & user management
│   ├── manager.html          # PM dashboard, risk alerts & backlog table
│   ├── developer.html        # Developer dashboard, effort logging & personal progress
│   ├── create-project.html   # Project creation & editing with live preview card
│   ├── create-task.html      # Task creation & intelligent recommendation engine
│   ├── sprint-planning.html  # Sprint planning board & workload capacity balancer
│   ├── task-details.html     # Deep task inspection, effort history & risk audit
│   ├── analytics.html        # Interactive Chart.js charts & KPI dashboard
│   ├── css/
│   │   ├── style.css         # Design system, layout, buttons, forms, tables, modals, toasts
│   │   ├── dashboard.css     # Metric cards, capacity meters, recommendation cards, charts
│   │   └── responsive.css    # Full media queries (mobile, tablet, desktop)
│   ├── js/
│   │   ├── storage.js        # LocalStorage data engine & explainable rule algorithms
│   │   ├── auth.js           # Session manager, role switching & toast utility
│   │   ├── navigation.js     # Global navigation bar & role switcher
│   │   ├── admin.js          # Admin controller & user CRUD
│   │   ├── manager.js        # PM controller & deadline risk monitoring
│   │   ├── developer.js      # Developer controller & effort logging
│   │   ├── projects.js       # Projects controller & form validation
│   │   ├── tasks.js          # Tasks controller & effort recording
│   │   ├── sprint-planning.js# Sprint planning & backlog allocation
│   │   └── analytics.js      # Chart.js visualization engine
│   └── vendor/
│       └── chart.umd.min.js  # Bundled standalone Chart.js v4.6.1 library
├── test-suite.js             # Automated unit & integration verification test runner
└── README.md
```

---

## 🚀 How to Run Locally

Because this is a pure frontend application, you can run it using any static web server or open the HTML files directly in any modern web browser.

### Option 1: Python HTTP Server (Recommended)
From the project root:
```bash
python3 -m http.server 8000
```
Then navigate in your browser to:
[http://localhost:8000/frontend/index.html](http://localhost:8000/frontend/index.html)

### Option 2: Node.js (npx serve)
```bash
npx serve frontend
```

### Option 3: Automated Verification Suite
Run the comprehensive verification script to validate all files, empty state policies, rule algorithms, and HTTP serving:
```bash
node test-suite.js
```

---

## 🧪 Testing Checklist & Verification Guide

Follow this walkthrough to test every feature from a clean empty slate:

### 1. First Administrator Setup (`index.html`)
- Open [http://localhost:8000/frontend/index.html](http://localhost:8000/frontend/index.html).
- Notice the **First-Time Setup: Configure Administrator** card is displayed because 0 users exist.
- Enter your name (e.g. `System Administrator`), email (e.g. `admin@company.org`), and weekly capacity (`40`).
- Click **"Create Administrator Account"** &rarr; immediately redirects to `admin.html`.

### 2. User & Team Management (`admin.html`)
- On the Admin dashboard, click **"+ Add New User"**.
- Create a Project Manager:
  - Name: `Sarah PM`, Email: `sarah@company.org`, Role: `Project Manager`.
- Create Developers with distinct skills and capacity:
  - Developer 1: `Marcus Wright`, Email: `marcus@company.org`, Role: `Developer`, Skills: `TypeScript, Node.js, Docker, PostgreSQL`, Experience: `Senior`, Capacity: `40h`.
  - Developer 2: `Kyle Reese`, Email: `kyle@company.org`, Role: `Developer`, Skills: `HTML5, CSS3, JavaScript`, Experience: `Junior`, Capacity: `30h`.
- Verify the user table updates immediately with roles, skills tags, and capacity.

### 3. Project Creation (`create-project.html`)
- Click **"+ Create New Project"** from the navbar or Admin dashboard.
- Enter Project ID (e.g. `PRJ-001`), Project Name, and target deadlines.
- Select `Sarah PM` as Project Manager and assign both developers to the team.
- Observe the **Live Preview Card** update in real time.
- Click **"Save Project"** &rarr; redirects to Admin dashboard showing project card with zero initial tasks.

### 4. Sprint & Task Planning (`sprint-planning.html` & `create-task.html`)
- Switch active role to **"Sarah PM (MANAGER)"** using the top-right role switcher.
- Navigate to **"🎯 Sprint Planning"**:
  - Click **"+ New Sprint"** and create Sprint `SP-001` (e.g. 35 capacity points, 2-week duration).
- Navigate to **"+ New Task"**:
  - Create Task `TSK-101`: Title `Database Architecture`, Estimate `15h`, Story Points `5`, Skills `PostgreSQL, Docker`.
  - Look at the **Intelligent Resource Matcher** on the right side: notice `Marcus Wright` ranks highest with a transparent score breakdown (Skill match 50/50, Capacity 30/30, Senior experience 20/20).
  - Create Task `TSK-102`: Title `Navigation UI`, Estimate `20h`, Story Points `5`, Skills `HTML5, CSS3`, Assignee `Kyle Reese`.
- Return to **"🎯 Sprint Planning"**:
  - Move tasks from **Backlog** to **Sprint**.
  - Review the **Team Workload Capacity** sidebar meters update dynamically.

### 5. Developer Task Execution & Effort Logging (`developer.html`)
- Switch active role to **"Kyle Reese (DEVELOPER)"**.
- Notice the **Weekly Workload Gauge** shows current allocated hours vs 30h limit.
- Under Assigned Tasks, update status from `Ready` to `In Progress`.
- Click **"⏱️ Log Effort"**:
  - Enter `6.5` hours and add progress notes.
  - Submit &rarr; actual effort updates to `6.5h / 20h` and work log history is persisted.

### 6. Deadline Risk & Delay Monitoring (`manager.html` & `task-details.html`)
- Switch back to **"Sarah PM"** and view the PM dashboard.
- Observe the **Deadline Risk Summary** table and risk badges.
- Open `task-details.html` for any task to view the detailed mathematical risk breakdown formula.

### 7. Interactive Analytics (`analytics.html`)
- Navigate to **"📈 Analytics"**.
- View all 6 dynamic Chart.js visualizations (Velocity, Status, Workload vs Capacity, Burndown, Skills Supply/Demand, Deadline Risk Matrix).

### 8. Data Persistence, JSON Backup & Clean Wipe
- Refresh any page &rarr; all state remains intact in browser LocalStorage.
- Go to `admin.html`:
  - Click **"💾 Export JSON Backup"** to download the complete database state.
  - Click **"🗑️ Wipe All Data"** to clear storage back to 100% empty state.
  - Click **"📂 Import JSON Backup"** to restore your saved data file.
