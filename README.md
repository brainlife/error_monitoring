# Brainlife Workflow Monitor (Amaretti Dashboard)

An advanced, high-performance orchestration and infrastructure monitoring dashboard built for the **Brainlife** platform. It connects to the live **Amaretti API** and **Warehouse API** to provide developers, system administrators, and scientific users with real-time operational metrics for task orchestration, compute cluster health, and application execution diagnostics.

---

## 🚀 Key Features

### 1. Unified Operational Dashboard
- **KPI Metrics:** Track *Running*, *Completed*, *Failed*, and *Active* tasks in real-time.
- **Activity Timeline:** Dynamic visual timeline of current task executions.
- **Compute Grid:** Immediate health check statuses of connected clusters and cloud compute environments.

### 2. Compute Resources Monitor
- Deep inspection of connected clusters (e.g., Karst, BigRed3, Carbonate, AWS Batch).
- **Cluster Diagnostics:** View details on active jobs, memory consumption, CPU load, and verify node connectivity.

### 3. Application Services Control Center
- **Service Directory:** Monitor logical applications (e.g., `validator-neuro-freesurfer`, `app-freesurfer`, `app-stage`).
- **Dependency Flow Graph:** Displays service-level dependency trees (e.g., `API` ➔ `Scheduler` ➔ `App` ➔ `Archive Service`).
- **Cluster Distribution:** Worker allocation metrics per cluster showing how computational loads are balanced.
- **SVG Performance Sparklines:** 30-day trends for Success Rates, Avg Runtimes, Throughput, and Queue depth.

### 4. Workflow Tasks Explorer
- Search and filter all workflow histories.
- Control active executions with actions like **Rerun Task** or **Stop Task** directly from the UI.
- Interactive side-car log consoles streaming stderr/stdout outputs for easy debugging.

### 5. Workflow Performance Analytics
- Visualize queue trends, success rates, and compute usage distributions.
- **Reports Export:** Export custom filtered analytics reports to CSV or JSON formats.

### 6. System Administration Panel
- **Categorized Configurations:** VS Code-style Settings panel for General, API, Authentication, Compute, Notifications, Logging, Storage, and Security.
- **Diagnostics Suite:** automated check verifying DNS, TLS, Token validity, Mongo connectivity, Redis availability, and Scheduler health with real-time latency reporting.
- **Config History Audit Trail:** Audit logs tracking setting changes by administrator accounts.
- **Danger Zone:** Crimson actions panel to flush caches, restart worker pools, reconnect nodes, or clear logs.

---

## 🛠️ Technology Stack

- **Framework:** React 18 (TypeScript)
- **Bundler:** Vite
- **Styling:** Tailwind CSS & Custom CSS variables (glassmorphism overlays, custom scrollbars, and ambient backdrop glow meshes)
- **Icons:** Lucide React
- **Type Safety:** TypeScript `strict` mode with build checks

---

## ⚙️ Project Setup

### 1. Prerequisites
Ensure you have **Node.js (v18+)** and **npm** installed on your machine.

### 2. Installation
Clone the repository and install project dependencies:
```bash
npm install
```

### 3. Environment Configuration
Create or edit the `.env` file in the project root:
```env
VITE_API_URL=https://brainlife.io/api/amaretti
```

### 4. Running Locally
Launch the local Vite development server:
```bash
npm run dev
```

### 5. Static Build
Compile the application into optimized static assets ready for production hosting:
```bash
npm run build
```
Verify the production build folder locally using:
```bash
npm run preview
```

### 6. Static Analysis & Type Checking
To run the TypeScript compiler checks:
```bash
npm run typecheck
```
To run ESLint checking:
```bash
npm run lint
```

---

## 📁 Project Architecture

```
├── public/
│   └── Assets/
│       └── icon1.png          # Brainlife Branding Logo
├── src/
│   ├── api.ts                 # Amaretti & Warehouse fetch utilities & Auth management
│   ├── App.tsx                # View router, dashboard state, and polling services
│   ├── data.ts                # TypeScript interfaces, schemas, and analytics structures
│   ├── index.css              # Custom styling definitions & glassmorphism theme layers
│   ├── main.tsx               # Application entrypoint
│   └── components/            # Reusable UI component modules
│       ├── AnalyticsView.tsx  # Charts and analytics reports generator
│       ├── ExecutionTimeline.tsx # Live activity feed
│       ├── KpiCards.tsx       # KPI metrics summaries
│       ├── LogConsole.tsx     # Stderr/stdout terminal output drawer
│       ├── Login.tsx          # Single Sign-On (Google/GitHub/ORCID) and local credential login
│       ├── ResourceGrid.tsx   # Dashboard infrastructure view
│       ├── ResourcesView.tsx  # Detailed compute resources panel
│       ├── ServicesView.tsx   # Services metrics, dependencies, and sparklines
│       ├── Settings.tsx       # VS Code-style Admin config forms & Connection diagnostics
│       ├── Sidebar.tsx        # Navigation layout
│       └── TaskTable.tsx      # High-density task listings
```

---

## 📡 API Integrations

The dashboard integrates with three distinct Brainlife API layers defined in `src/api.ts`:
1. **Amaretti API (`/amaretti`):** Used to fetch resources, list tasks, retrieve stderr/stdout execution logs, rerun workflow tasks, and query cluster metrics.
2. **Warehouse API (`/warehouse`):** Used to fetch and map project names and group IDs.
3. **Authentication API (`/auth`):** Used to authenticate administrator credentials, manage session JWT storage, decode tokens, and fetch the platform user directory.



//on the analytics page we want stats like cummulative statistics,average statistics,progress overtime, these should be displayed as graphs or bar charts or tables
//on the task page we need to display more summary informations through charts,graphs first before table  also we need to be able to search jobs by project name, group name, task id, user name, job name, datatyoe etc
//