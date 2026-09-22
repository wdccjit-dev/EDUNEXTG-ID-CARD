# Atlas ID · School ID Card Management System

A multi-tenant, INTERNAL-grade ID card design, generation, approval, and printing platform built with React, Express, tRPC, MySQL, and Drizzle ORM.

---

## Key Features

### Multi-Tenant Architecture & Role-Based Access Control (RBAC)
- **Super Admin Portal (`/admin`)**:
  - **School Management**: Onboard new schools, configure metadata, manage credentials, and delete schools (with automatic cascading cleanup of associated users).
  - **User Governance**: View and manage all platform operators and school administrators.
  - **Template Designer**: Create, customize, activate, or deactivate canvas-based ID card templates (orientation, background styling, dynamic placeholders, barcodes, and QR codes).
  - **Workflow & Approvals**: Review ID card requests submitted by schools, approve/reject individual or batch submissions, and trigger print production.
  - **Audit Logs & Analytics**: Track administrative actions, system events, and download overview reports.
  - **Platform Settings**: Manage organizational profile and platform branding.

- **School Portal (`/school`)**:
  - **Tenant Isolation**: Strict database and API-level data isolation ensuring schools access only their own students, cards, and notifications.
  - **Template Selection**: Browse active templates assigned by the Super Admin and select default school layouts.
  - **ID Card Creation**: Add student and staff ID card records individually or through structured bulk entries.
  - **Approval Pipeline**: Submit generated cards for Super Admin review and monitor approval statuses in real-time.
  - **Export & Print**: Generate high-resolution PDF cards (single or multi-up grid sheets) with embedded QR codes and barcodes ready for printing.
  - **Account & Security**: Update contact information and self-manage passwords securely.

---

## Technology Stack

- **Frontend**:
  - React 19, TypeScript
  - Vite 7
  - Tailwind CSS v4
  - Radix UI Primitives & Lucide React
  - Wouter (Routing)
  - TanStack Query v5
  - Sonner (Notifications)
  - jsPDF & QR Code generator

- **Backend**:
  - Node.js & Express
  - tRPC v11 for end-to-end type-safe APIs
  - Drizzle ORM with MySQL (`mysql2`)
  - Jose (JWT authentication via secure HTTP-only cookies)
  - PDFKit for server-side PDF document generation

---

## Project Structure

```
├── client/                 # Frontend SPA application
│   ├── public/             # Static assets (favicons, logos)
│   └── src/
│       ├── components/     # Reusable UI components & dialogs
│       ├── contexts/       # Theme and global UI contexts
│       ├── lib/            # tRPC and REST API client adapters
│       ├── pages/          # Portal pages (Home, Login, Designer, etc.)
│       └── App.tsx         # Route definitions and RBAC router guards
├── drizzle/                # Database schema definitions and migrations
│   └── schema.ts           # Drizzle MySQL schema definition
├── server/                 # Backend server application
│   ├── _core/              # Framework core, server initialization & auth middleware
│   ├── api.ts              # RESTful API handlers (schools, users, cards, templates)
│   ├── appAuth.ts          # Authentication, password hashing, and session logic
│   ├── db.ts               # Drizzle connection & database helper queries
│   ├── pdfGenerator.ts     # Server-side ID card PDF generation
│   ├── routers.ts          # tRPC root router
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
- **pnpm**: v9.x or v10.x
- **MySQL**: 8.0+ running locally or accessible via network

### 1. Environment Setup
Configure your environment variables in `.env`:
```env
DATABASE_URL="mysql://username:password@localhost:3306/id_card_db"
JWT_SECRET="your-secure-random-jwt-secret"
PORT=3000
NODE_ENV=development
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Database Migration
Apply the database schema to your MySQL instance:
```bash
pnpm db:push
```

### 4. Development Seeding (Optional)
To seed initial administrative and test school accounts for local development:
```bash
pnpm db:seed-auth
```
*(Note: `seed-auth` is strictly locked out when `NODE_ENV=production`)*

### 5. Start Development Server
```bash
pnpm dev
```
The application will be available at `http://localhost:3000`.

---

## Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `pnpm dev` | `cross-env NODE_ENV=development tsx watch server/_core/index.ts` | Start local development server with hot-reloading |
| `pnpm build` | `vite build && esbuild server/_core/index.ts ...` | Build client bundle and bundle server for production |
| `pnpm start` | `cross-env NODE_ENV=production node dist/index.js` | Run the compiled production bundle |
| `pnpm check` | `tsc --noEmit` | Type check entire project |
| `pnpm test` | `vitest run --fileParallelism=false` | Execute full Vitest test suite |
| `pnpm format` | `prettier --write .` | Format codebase |
| `pnpm db:push` | `drizzle-kit generate && drizzle-kit migrate` | Generate and apply schema migrations |

---

## Production Deployment

1. Set `NODE_ENV=production` and configure your production `DATABASE_URL` and `JWT_SECRET`.
2. Build the production package:
   ```bash
   pnpm build
   ```
3. Launch the server:
   ```bash
   pnpm start
   ```

---

## License
MIT License
DEVELOPED BY RISHU RAJAK
