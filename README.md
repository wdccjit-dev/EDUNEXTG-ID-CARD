# Insight Education · School ID Card Management Suite

**Insight Education Management Suite** (Version 2.2.0) by **EduNextG** is an INTERNAL-grade, multi-tenant student identity lifecycle platform. Engineered for school networks, colleges, and academies, it unifies drag-and-drop ID card template design, multi-stage approval workflows, cryptographic QR code verification, and high-resolution batch PVC print production into a single, intuitive system.



---

## 🌟 Key Features

### 🏢 Multi-Tenant Architecture & Role-Based Access Control (RBAC)
- **Role Hierarchy**: Strict role separation between `SUPER_ADMIN`, `SCHOOL_ADMIN`, `SCHOOL_OPERATOR`, and `VIEWER`.
- **Tenant Data Isolation**: Schools operate in strictly isolated tenant scopes at database, API, and session layers. Cross-school data exposure is prevented by design.
- **Super Admin Portal (`/admin`)**:
  - **School Governance**: Register new schools, configure unique short codes, manage school contact metadata, generate login credentials (`ID Pass`), and delete schools with automatic cascading cleanup.
  - **User Management**: Provision, activate, or deactivate school operators and administrators.
  - **Visual Template Designer**: Interactive canvas editor for front and back ID card templates supporting custom dimensions, portrait and landscape orientations, color palettes, photo/signature placeholders, barcodes (Code128), and QR codes.
  - **Card Review & Approvals**: Multi-card review queue with live card previews, direct approval/rejection, change request notes, and bulk actions.
  - **Audit Logs & Activity**: Append-only administrative and school event ledger with filterable timelines, CSV export, and clear action histories.
  - **Platform Settings**: Exclusive to Super Admin (safely hidden from the school portal) for managing platform configurations and branding.

- **School Portal (`/school`)**:
  - **Template Selection**: Browse active templates published by the Super Admin and select the school's official template.
  - **Student ID Card Management**: Create and edit student ID card records with dynamic fields, photo uploads, and signature support.
  - **Approval Pipeline**: Track full card lifecycle (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `CHANGES_REQUIRED` / `REJECTED` → `PRINTED`).
  - **Print & PDF Export**: Instant preview and download of single or batch print-ready cards formatted for standard CR80 PVC card dimensions.
  - **Focused Workspace**: Streamlined interface tailored for school operators; administrative settings are restricted to Super Admin.

### 📱 Full Cross-Device Responsiveness
- **Adaptive Layouts**: Optimized for mobile phones (from 320px), tablets, laptops, and ultra-wide desktop monitors.
- **Collapsible Mobile Navigation**: Slide-out drawer with backdrop blur overlay and auto-collapse upon navigation.
- **Scroll-Safe Split Modals**: ID card creation and review dialogs feature responsive split views (`overflow-y-auto lg:overflow-hidden`) that stack seamlessly on mobile without clipping canvas previews.
- **Controlled Table Scrolling**: Wide tabular datasets adapt with contained horizontal scrolling (`overflow-x-auto min-w-[...]`), preserving layout structure on narrow screens.

### 🔒 Security, Validation & Governance
- **Session Authentication**: Password hashing using Scrypt with unique per-user salts; signed JWT sessions stored in HTTP-only, SameSite cookies.
- **Phone Number Validation**: Strict 10-digit numeric constraint with a dedicated `+91` prefix badge and inline validation feedback.
- **File Upload Protection**: Magic-byte MIME type inspection for photo and asset uploads (PNG, JPEG, WebP) to prevent file extension spoofing.
- **Audit Trails**: Structured event logging capturing actor identities, timestamps, entity types, and state changes.

---

## 🛠️ Technology Stack

- **Frontend**:
  - **Framework**: React 19, TypeScript, Vite 7
  - **Styling**: Tailwind CSS v4, Tailwind Animate
  - **UI Primitives**: Radix UI, Lucide React
  - **Routing**: Wouter
  - **State & Data**: TanStack Query v5, Sonner notifications
  - **Rendering**: jsPDF, JsBarcode, QRCode

- **Backend**:
  - **Runtime**: Node.js (v20+) & Express
  - **API Layer**: RESTful endpoints and tRPC v11
  - **Database & ORM**: MySQL (`mysql2`) with Drizzle ORM
  - **Auth & Tokens**: Jose (JWT) & Node Crypto (Scrypt)
  - **Document Generation**: PDFKit vector rendering engine

---

## 📁 Project Structure

```
├── client/                 # Frontend Single Page Application
│   ├── public/             # Static assets, logos, and catalogs
│   └── src/
│       ├── components/     # UI components, modals (PrintModal, CardRenderer, AuditLogs)
│       ├── contexts/       # Global authentication and UI contexts
│       ├── lib/            # API client adapters and utilities
│       ├── pages/          # Pages (Home, Login, TemplateDesigner, IdCardFormModal)
│       └── App.tsx         # Route configuration and authentication guards
├── drizzle/                # Database schema definitions and migrations
│   ├── meta/               # Migration snapshots and journals
│   ├── *.sql               # Sequential migration scripts
│   └── schema.ts           # Drizzle MySQL relational schema
├── server/                 # Backend server application
│   ├── _core/              # Core server framework and middleware
│   ├── api.ts              # REST API handlers (schools, cards, templates, approvals)
│   ├── appAuth.ts          # Authentication, Scrypt hashing, and password management
│   ├── db.ts               # Database connection and queries
│   ├── pdf.ts              # Server-side PDF generation
│   ├── routers.ts          # tRPC route definitions
│   └── storage.ts          # Storage integration
├── scripts/                # Development and migration scripts
│   ├── seed-auth.ts        # Development account seeder
│   └── migrate-database.mjs# Migration runner
├── package.json            # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20.x or higher
- **pnpm**: v9.x or v10.x (Recommended: `pnpm@10.4.1`)
- **MySQL**: 8.0+ running locally or on a remote host

### 1. Environment Configuration
Create a `.env` file in the root directory (refer to `.env.example`):
```env
# Database connection
DATABASE_URL="mysql://username:password@localhost:3306/id_card_db"

# Authentication secret (minimum 32 characters)
JWT_SECRET="your-secure-random-jwt-secret-at-least-32-chars-long"

# Server configuration
PORT=3000
NODE_ENV=development
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Database Migration
Apply the database schema:
```bash
pnpm db:migrate
```

### 4. Seed Development Accounts
Populate initial administrative and test school accounts:
```bash
pnpm db:seed-auth
```
*(Note: `seed-auth` is blocked when `NODE_ENV=production`)*

#### Default Seed Credentials:
| Portal | Email / Login ID | Password | Role |
|---|---|---|---|
| Super Admin | `admin@edunextg.com` | `Duronto321` | `SUPER_ADMIN` |
| School Admin | `school@example.test` | `School123!` | `SCHOOL_ADMIN` |

### 5. Start Development Server
```bash
pnpm dev
```
The application will be accessible at `http://localhost:3000`.

---

## 📜 Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `pnpm dev` | `cross-env NODE_ENV=development tsx watch server/_core/index.ts` | Start development server with live reload |
| `pnpm build` | `vite build && esbuild server/_core/index.ts ...` | Compile client SPA and server bundle |
| `pnpm start` | `cross-env NODE_ENV=production node dist/index.js` | Run compiled production build |
| `pnpm check` | `tsc --noEmit` | Validate TypeScript types across frontend and backend |
| `pnpm db:migrate` | `node scripts/migrate-database.mjs` | Apply committed database migrations |
| `pnpm db:seed-auth` | `tsx scripts/seed-auth.ts` | Seed dev accounts (Super Admin & School Admin) |

---

## 🚢 Production Deployment

1. Configure `.env` with production database credentials, a 32+ character `JWT_SECRET`, and `NODE_ENV=production`.
2. Install dependencies, run type checks, and build:
   ```bash
   pnpm install --frozen-lockfile
   pnpm check
   pnpm build
   ```
3. Apply database migrations:
   ```bash
   pnpm db:migrate
   ```
4. Start the server using a process manager like PM2:
   ```bash
   pm2 start dist/index.js --name "insight-education"
   ```



---

## 📄 License
MIT License

**Developed by [Rishu Rajak](https://github.com/r1shurajak)** ·
