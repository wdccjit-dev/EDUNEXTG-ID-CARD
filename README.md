# Insight Education · School ID Card Management System

A multi-tenant, INTERNAL-grade ID card design, generation, approval, and printing platform built with React 19, Express, tRPC v11, MySQL, and Drizzle ORM.

---

## Key Features

### Multi-Tenant Architecture & Role-Based Access Control (RBAC)
- **Role Hierarchy**: Strict role separation between `SUPER_ADMIN`, `SCHOOL_ADMIN`, `SCHOOL_OPERATOR`, and `VIEWER`.
- **Tenant Isolation**: Schools are completely isolated at the database, query, and session layer. Cross-school data leaks and unauthorized card modifications are strictly prohibited.
- **Super Admin Portal (`/admin`)**:
  - **School Management**: Onboard new schools, configure short codes and metadata, manage admin credentials, and delete schools (with automatic cascading cleanup).
  - **User Governance**: Create, edit, activate/deactivate platform operators and school administrators.
  - **Template Designer**: Create and configure canvas-based ID card templates (portrait/landscape, dimensions, accent themes, dynamic text fields, photo placeholders, barcodes, and QR codes).
  - **Workflow & Approvals**: Review submitted cards from schools, approve or reject with audit comments, request changes, and track production.
  - **Audit Logs & Analytics**: Complete audit trail recording actions, timestamps, actor user IDs, IP addresses, entity types, and state diffs (`oldValues` vs `newValues`).
  - **Platform Settings**: Manage branding, default school configurations, and system preferences.

- **School Portal (`/school`)**:
  - **Template Selection & Assignment**: Browse and assign active templates published by the Super Admin.
  - **ID Card Creation**: Add student and staff ID card records individually or through structured bulk entries.
  - **Approval Pipeline**: Track full card lifecycle (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `CHANGES_REQUIRED` / `REJECTED` → `PRINTED`).
  - **Export & Print**: Generate high-resolution PDF cards (single cards or multi-card print grid sheets) with barcodes and QR codes.
  - **Account & Security**: Self-service profile updates, password changes, and secure password reset flow.

### Security & Hardening
- **Authentication**: Secure scrypt password hashing with unique per-user salts; HTTP-only, SameSite JWT session cookies.
- **File Upload Security**: Strict magic-byte MIME type validation for uploads (PNG, JPEG, WebP, GIF), preventing malicious file extension spoofing.
- **Audit Logging**: Comprehensive structured event logs on administrative actions, card state transitions, and user modifications.

---

## Technology Stack

- **Frontend**:
  - React 19, TypeScript
  - Vite 7
  - Tailwind CSS v4 & Tailwind Animate
  - Radix UI Primitives & Lucide React
  - Wouter (Routing)
  - TanStack Query v5
  - Sonner (Toast notifications)
  - jsPDF & JsBarcode / QRCode generator

- **Backend**:
  - Node.js (v20+) & Express
  - tRPC v11 for end-to-end type-safe APIs
  - Drizzle ORM with MySQL (`mysql2`)
  - Jose (JWT signing and verification via HTTP-only cookies)
  - PDFKit for server-side ID card rendering and batch print sheets

---

## Project Structure

```
├── client/                 # Frontend Single Page Application (SPA)
│   ├── public/             # Static assets (favicons, logos)
│   └── src/
│       ├── components/     # Reusable UI components, dialogs, form controls
│       ├── contexts/       # Theme, auth, and global UI contexts
│       ├── lib/            # tRPC and REST API client adapters
│       ├── pages/          # Portal pages (Admin, School, Designer, Login, etc.)
│       └── App.tsx         # Route definitions and RBAC router guards
├── drizzle/                # Database schema definitions and migrations
│   ├── meta/               # Drizzle migration journal and snapshots
│   ├── *.sql               # Sequential migration scripts (0000 - 0007)
│   └── schema.ts           # Drizzle MySQL schema definition
├── server/                 # Backend server application
│   ├── _core/              # Framework core, server bootstrap & middleware
│   ├── api.ts              # RESTful API handlers (auth, schools, cards, templates, uploads)
│   ├── appAuth.ts          # Scrypt password hashing, session tokens, password resets
│   ├── db.ts               # Drizzle connection & database helper queries
│   ├── idCards.ts          # ID card helper utilities & status transitions
│   ├── pdf.ts              # Server-side ID card PDF generation (PDFKit)
│   ├── routers.ts          # tRPC root router
│   ├── storage.ts          # Storage integration (Forge S3 / local disk fallback)
│   └── *.test.ts           # Vitest integration and isolation test suite
├── scripts/                # Utility and development scripts
│   └── seed-auth.ts        # Development-only account seeder (blocked in production)
├── package.json            # Project dependencies and npm scripts
├── pnpm-lock.yaml          # Pnpm lockfile
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build and development configuration
```

---

## Getting Started

### Prerequisites
- **Node.js**: v20.x or later
- **pnpm**: v9.x or v10.x (Recommended: `pnpm@10.4.1`)
- **MySQL**: 8.0+ running locally or accessible via network

> [!NOTE]
> Always use `pnpm` rather than `npm` when managing dependencies, as the project defines patches and workspace overrides in `pnpm-lock.yaml`.

### 1. Environment Setup
Create a `.env` file in the project root:
```env
# Database connection
DATABASE_URL="mysql://username:password@localhost:3306/id_card_db"

# Authentication secret (minimum 32 characters)
JWT_SECRET="your-secure-random-jwt-secret-at-least-32-chars-long"

# Server configuration
PORT=3000
NODE_ENV=development

# Optional OAuth configuration (if external SSO is used)
# OAUTH_SERVER_URL="https://oauth.example.com"
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Database Migration
Apply the database schema to your MySQL instance:
```bash
pnpm db:migrate
```

### 4. Seed Development Accounts
Seed initial administrative and test school accounts for local development:
```bash
pnpm db:seed-auth
```
*(Note: `seed-auth` is strictly locked out when `NODE_ENV=production`)*

#### Default Seed Credentials:
| Portal | Email | Password | Role |
|---|---|---|---|
| Super Admin | `admin@edunextg.com` | `Duronto321` | `SUPER_ADMIN` |
| School Admin | `school@example.test` | `School123!` | `SCHOOL_ADMIN` |

### 5. Start Development Server
```bash
pnpm dev
```
The application will be accessible at `http://localhost:3000`.

---

## Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `pnpm dev` | `cross-env NODE_ENV=development tsx watch server/_core/index.ts` | Start local development server with hot reload |
| `pnpm build` | `vite build && esbuild server/_core/index.ts ...` | Build client SPA and bundle Node.js server |
| `pnpm start` | `cross-env NODE_ENV=production node dist/index.js` | Run compiled production bundle |
| `pnpm check` | `tsc --noEmit` | Type check frontend and backend code |
| `pnpm test` | `vitest run --fileParallelism=false` | Execute full Vitest test suite |
| `pnpm format` | `prettier --write .` | Format codebase using Prettier |
| `pnpm db:push` | `drizzle-kit generate && drizzle-kit migrate` | Generate and apply database migrations |
| `pnpm db:migrate` | `node scripts/migrate-database.mjs` | Apply committed migrations without generating new files |
| `pnpm db:setup` | `tsx scripts/setup-database.ts` | Apply migrations and create/update the initial Super Admin |
| `pnpm db:seed-auth` | `tsx scripts/seed-auth.ts` | Seed dev accounts (Super Admin & School Admin) |

---

## Troubleshooting & Tips

- **Package Management**:
  - Always use `pnpm` (e.g. `pnpm install`, `pnpm add -D <package>`). Running `npm install` directly can fail due to package-manager specific overrides or lockfile differences.
- **Port Conflict (`EADDRINUSE`)**:
  - In development (`NODE_ENV=development`), if port `3000` is occupied, the server automatically searches and binds to the next available port (e.g. `3001`, `3002`). Check terminal output for the assigned URL.
- **`OAUTH_SERVER_URL is not configured!` Notice**:
  - This is an informational warning for optional external SSO integration. The core system operates fully using local credential-based authentication (`/api/auth/login`).
- **Database Connection Issues**:
  - Ensure MySQL is running and that the user specified in `DATABASE_URL` has privileges to create and modify tables.

---

## Production Deployment

1. Copy `.env.example` to `.env` and configure `NODE_ENV=production`, `DATABASE_URL`, a unique `JWT_SECRET` of at least 32 characters, and `PORT`.
2. Install from the lockfile, verify, and build:
   ```bash
   pnpm install --frozen-lockfile
   pnpm check
   pnpm test
   pnpm build
   ```
3. Back up the database, then apply committed migrations:
   ```bash
   pnpm db:migrate
   ```
4. Launch or restart the production server:
   ```bash
   pnpm start
   ```

   With PM2, use `pm2 restart id-card-management --update-env` after the build and migration complete.

5. Configure the reverse proxy to use `/healthz` for liveness and `/readyz` for readiness. Production defaults to trusting one proxy hop; set `TRUST_PROXY` if your topology differs.

The server validates its environment and required database tables during startup. If a migration is missing, startup fails with an actionable error instead of serving a partially working dashboard.

---

## License
MIT License

DEVELOPED BY [r1shurajak](https://github.com/r1shurajak)!
