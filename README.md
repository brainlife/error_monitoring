<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/brand/brainlife-mark-on-dark.svg">
    <img src=".github/brand/brainlife-mark-on-light.svg" alt="brainlife.io" width="140">
  </picture>
</p>

<h1 align="center">brainlife Workflow Monitor</h1>

<p align="center">
  An operations dashboard for brainlife.io: tasks, compute resources, App services and failures at a glance.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-active-brightgreen.svg" alt="Status: active">
  <a href="https://brainlife.io"><img src="https://img.shields.io/badge/brainlife.io-site-3b9fd0.svg" alt="brainlife.io"></a>
  <a href="https://brainlife.io/docs"><img src="https://img.shields.io/badge/Docs-brainlife.io%2Fdocs-005981.svg" alt="Documentation"></a>
  <a href="https://doi.org/10.1038/s41592-024-02237-2"><img src="https://img.shields.io/badge/DOI-10.1038%2Fs41592--024--02237--2-e57536.svg" alt="Nature Methods paper"></a>
</p>

## 🧠 At a glance

| | |
|---|---|
| 🧭 **What** | Admin dashboard over the Amaretti and Warehouse APIs: task KPIs and timeline, compute-resource health, App services, task explorer, performance analytics |
| 🧱 **Stack** | React 18 · TypeScript · Vite · Tailwind CSS · Lucide icons |
| 🔌 **Talks to** | [amaretti-next](https://github.com/brainlife/amaretti-next) · [warehouse-next](https://github.com/brainlife/warehouse-next) · brainlife.io sign-in |
| 🕰️ **Last change** | 2026-09-30 |

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



//on the analytics page we want stats like cumulative statistics,average statistics,progress overtime, these should be displayed as graphs or bar charts or tables
//on the task page we need to display more summary information through charts,graphs first before table  also we need to be able to search jobs by project name, group name, task id, user name, job name, datatype etc
//

## 🔗 Related repositories

| Repository | Role |
|---|---|
| [warehouse-next](https://github.com/brainlife/warehouse-next) | Projects, datasets and Apps API |
| [amaretti-next](https://github.com/brainlife/amaretti-next) | Task orchestration API |
| [auth-next](https://github.com/brainlife/auth-next) | Sign-in and JWTs |
| [monitor](https://github.com/brainlife/monitor) | Earlier prototype |

## 📚 Citing

If you use brainlife.io in your work, please cite:

> Hayashi S, Caron BA, Heinsfeld AS, et al. brainlife.io: a decentralized and open-source cloud platform to support neuroscience research. *Nature Methods* 21:809–813 (2024). [doi:10.1038/s41592-024-02237-2](https://doi.org/10.1038/s41592-024-02237-2)

## 💰 Funding

brainlife.io is developed by the Pestilli Lab at The University of Texas at Austin and is publicly funded; acknowledging that support helps keep it running.

<details>
<summary>Grants (verified list, from <a href="https://github.com/brainlife/ezbids/blob/master/CREDITS.md#funding">ezbids CREDITS.md</a>)</summary>

| Funder | Award | Title |
|---|---|---|
| NIH NINDS | [U24NS140384](https://reporter.nih.gov/project-details/U24NS140384) | BRAIN CONNECTS: The Axonal Projectome EXchange (APEX) |
| NIH NIMH | [R01MH126699](https://reporter.nih.gov/project-details/R01MH126699) | Community-driven development of BIDS |
| NIH NIBIB | [R01EB030896](https://reporter.nih.gov/project-details/R01EB030896) | CRCNS US-France: open science and cloud computing of MEEG |
| NIH NIBIB | [R01EB029272](https://reporter.nih.gov/project-details/R01EB029272) | CRCNS US-France: lowering the barrier of entry to network neuroscience |
| NSF | [BCS-1636893](https://www.nsf.gov/awardsearch/showAward?AWD_ID=1636893), [2148729](https://www.nsf.gov/awardsearch/showAward?AWD_ID=2148729) | BD Spokes: Advanced Computational Neuroscience Network |
| NSF | [BCS-1734853](https://www.nsf.gov/awardsearch/showAward?AWD_ID=1734853), [2203524](https://www.nsf.gov/awardsearch/showAward?AWD_ID=2203524) | NCS-FO: Connectome mapping algorithms |
| NSF | [IIS-1912270](https://www.nsf.gov/awardsearch/showAward?AWD_ID=1912270), [2148700](https://www.nsf.gov/awardsearch/showAward?AWD_ID=2148700) | CRCNS US-German: DataLad |
| NSF | [ACI-1916518](https://www.nsf.gov/awardsearch/showAward?AWD_ID=1916518) | BD Hubs: Midwest Big Data Hub |
| Wellcome Trust | [226486](https://grantnav.threesixtygiving.org/grant/360G-Wellcome-226486_Z_22_Z) | Developing an international governance framework to advance global brain and mental health data equity and innovation |

</details>

## 🤝 Contributing

Issues and pull requests are welcome in this repository. For help using brainlife.io, see the [documentation](https://brainlife.io/docs).

## ⚖️ License

This repository does not include a license file yet.

<p align="center"><sub>brainlife.io · Brain data across scales. One place to analyze, share and publish it. · The University of Texas at Austin</sub></p>
