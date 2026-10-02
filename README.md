# Insight Education · School ID Card Management Suite

**Insight Education Management Suite** (Version 2.3.0) by **EduNextG** is an enterprise-grade, multi-tenant student and staff identity lifecycle platform. Engineered for school networks, colleges, and academies, it unifies drag-and-drop ID card template design, multi-stage approval workflows, cryptographic QR code verification, high-resolution batch PVC print production, procurement order tracking, and comprehensive reporting into a single, intuitive system.

---

## 🌟 Key Features

### 🏢 Multi-Tenant Architecture & Role-Based Access Control (RBAC)
- **Role Hierarchy**: Strict role separation between `SUPER_ADMIN`, `MARKETING_ADMIN`, `SCHOOL_ADMIN`, `SCHOOL_OPERATOR`, and `VIEWER`.
- **Tenant Data Isolation**: Schools operate in strictly isolated tenant scopes at database, API, and session layers. Cross-school data exposure is prevented by design.
- **Super Admin Portal (`/admin`)**:
  - **School Governance**: Register new schools, configure unique short codes, manage school contact metadata, generate login credentials (`ID Pass`), and delete schools with automatic cascading cleanup.
  - **User Management**: Provision, activate, or deactivate school operators, school admins, and marketing admins.
  - **Visual Template Designer**: Interactive canvas editor for front and back ID card templates supporting custom dimensions, portrait and landscape orientations, color palettes, photo/signature placeholders, barcodes (Code128), and QR codes.
  - **Card Review & Approvals**: Multi-card review queue with live card previews, direct approval/rejection, change request notes, and bulk actions.
  - **Order Management**: Oversee printing and accessory orders across all schools with status transitions (`PLACED` → `CONFIRMED` → `IN_PRODUCTION` → `DISPATCHED` → `DELIVERED` / `CANCELLED`).
  - **Audit Logs & Activity**: Append-only administrative and school event ledger with filterable timelines, CSV export, and clear action histories.
  - **Appearance & Platform Settings**: System settings and theme customizer (`/admin/settings`).

- **School Portal (`/school`)**:
  - **Template Selection**: Browse active templates published by the Super Admin and assign the school's official template.
  - **Student & Staff ID Card Management**: Create and edit ID card records with dynamic fields, photo uploads, and signature support.
  - **Bulk Data Import & Templates Dropdown**: Download dedicated Excel templates via a split menu for **Student Excel** and **Staff Excel** templates, with automatic bulk parsing.
  - **Bulk Photo ZIP Upload**: Upload a ZIP archive containing images named by student **Admission Number** or staff **Employee ID**; photos are automatically matched, resized, compressed (<100KB), and attached to the respective cards.
  - **Approval Pipeline**: Track full card lifecycle (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `CHANGES_REQUIRED` / `REJECTED` → `PRINTED`).
  - **Print & PDF Export**: Instant preview and download of single or batch print-ready cards formatted for standard CR80 PVC card dimensions.
  - **Order Creation & Lanyard Specs**: Submit card production orders with custom specifications including card material (PVC Standard / Premium), print sides (Single / Double), lanyard color, and lanyard width.
  - **Removed Cards History & Reports**: Dedicated reporting tabs to track cards removed or archived with full audit context (who removed, timestamp, class/section).
  - **School Settings**: Dedicated appearance settings (`/school/settings`) for personalization.

- **Marketing Portal (`/marketing`)**:
  - **Orders Tracking**: View, filter, and track order fulfillment states and school delivery schedules.
  - **Marketing Settings**: Dedicated appearance settings (`/marketing/settings`).

---

### 🎨 Appearance & Theming Engine
- **Three Appearance Modes**: Support for **Light**, **Dark**, and **System** (auto-detect OS preference with live listener).
- **Zero-Flash Hydration**: Inline execution script in `index.html` prevents white/dark screen flashes during page load.
- **Dynamic Meta Theme-Color**: Real-time synchronization of `<meta name="theme-color">` to match dark and light backgrounds on mobile browsers and PWAs.
- **Role-Aware Settings Navigation**: Dedicated Settings item in sidebars across Super Admin (`/admin/settings`), School Admin (`/school/settings`), and Marketing Admin (`/marketing/settings`).

---

### 📱 Full Cross-Device Responsiveness
- **Adaptive Layouts**: Optimized for mobile phones (from 320px), tablets, laptops, and ultra-wide desktop monitors.
- **Collapsible Mobile Navigation**: Slide-out drawer with backdrop blur overlay and auto-collapse upon navigation.
- **Scroll-Safe Split Modals**: ID card creation and review dialogs feature responsive split views (`overflow-y-auto lg:overflow-hidden`) that stack seamlessly on mobile without clipping canvas previews.
- **Controlled Table Scrolling**: Wide tabular datasets adapt with contained horizontal scrolling, preserving layout structure on narrow screens.

---

### 🔒 Security, Validation & Governance
- **Session Authentication**: Password hashing using Scrypt with unique per-user salts; signed JWT sessions stored in HTTP-only, SameSite cookies.
- **Phone Number Validation**: Strict 10-digit numeric constraint with a dedicated `+91` prefix badge and inline validation feedback.
- **File Upload Protection & Image Compression**: Magic-byte MIME type inspection for photo and asset uploads (PNG, JPEG, WebP) to prevent file extension spoofing; automated client/server compression keeps images optimized under 100 KB.
- **Audit Trails**: Structured event logging capturing actor identities, timestamps, entity types, and state changes.

---

## 🛠️ Technology Stack

- **Frontend**:
  - **Framework**: React 19, TypeScript, Vite 7
  - **Styling**: Tailwind CSS v4, Tailwind Animate
  - **UI Primitives**: Radix UI, Lucide React
  - **Routing**: Wouter
  - **State & Data**: TanStack Query v5, Sonner notifications
  - **Rendering & Barcodes**: jsPDF, JsBarcode, QRCode

- **Backend**:
  - **Runtime**: Node.js (v20+) & Express
  - **API Layer**: RESTful endpoints and tRPC v11
  - **Database & ORM**: MySQL (`mysql2`) with Drizzle ORM
  - **Auth & Tokens**: Jose (JWT) & Node Crypto (Scrypt)
  - **Document Generation**: PDFKit vector rendering engine
  - **Image Processing & Archives**: Sharp, Adm-Zip

---

## 📁 Project Structure

```
├── client/                 # Frontend Single Page Application
│   ├── public/             # Static assets, logos, and catalogs
│   └── src/
│       ├── components/     # UI components (PrintModal, CardRenderer, RemovedCardsHistory, AuditLogs, etc.)
│       ├── contexts/       # ThemeContext (Light/Dark/System), AuthContext
│       ├── lib/            # API client adapters, download utilities, and helpers
│       ├── pages/          # Pages (Home, Login, TemplateDesigner, Settings, etc.)
│       └── App.tsx         # Route configuration, theme provider, and authentication guards
├── drizzle/                # Database schema definitions and migrations
│   ├── meta/               # Migration snapshots and journals
│   ├── *.sql               # Sequential migration scripts
│   └── schema.ts           # Drizzle MySQL relational schema
├── server/                 # Backend server application
│   ├── _core/              # Core server framework and middleware
│   ├── api.ts              # REST API handlers (schools, cards, templates, approvals, orders)
│   ├── appAuth.ts          # Authentication, Scrypt hashing, and password management
│   ├── db.ts               # Database connection and queries
│   ├── pdf.ts              # Server-side PDF generation
│   ├── routers.ts          # tRPC route definitions
│   └── storage.ts          # Storage integration
├── scripts/                # Development, maintenance, and database scripts
│   ├── clean-test-data.ts  # Wipes all development/test records and re-seeds pristine Super Admin
│   ├── setup-database.ts   # Migrates schema and configures Super Admin
│   ├── seed-auth.ts        # Seeds sample school and development accounts
│   ├── recompress-existing-photos.ts # Re-compresses photos to optimized size
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

### 3. Database Setup & Migrations
Apply the database schema and initialize the Super Admin account:
```bash
pnpm db:setup
```
*(Or run `pnpm db:migrate` if applying incremental migrations)*

### 4. Optional Seeding (Development only)
If you wish to seed sample schools and test accounts for local preview:
```bash
pnpm db:seed-auth
```
*(Note: `seed-auth` is blocked when `NODE_ENV=production`)*

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
| `pnpm test` | `vitest run --fileParallelism=false` | Execute comprehensive test suite |
| `pnpm db:migrate` | `node scripts/migrate-database.mjs` | Apply committed database migrations |
| `pnpm db:setup` | `tsx scripts/setup-database.ts` | Apply migrations and setup/update Super Admin |
| `pnpm db:seed-auth` | `tsx scripts/seed-auth.ts` | Seed dev accounts (Super Admin & School Admin) |

---

## 🚢 Production Deployment

1. Configure `.env` with production database credentials, a 32+ character `JWT_SECRET`, and `NODE_ENV=production`.
2. Install dependencies, run type checks, and build:
   ```bash
   pnpm install --frozen-lockfile
   pnpm check
   pnpm test
   pnpm build
   ```
3. Apply database setup / migrations:
   ```bash
   pnpm db:setup
   ```
4. Start the server using a process manager like PM2:
   ```bash
   pm2 start dist/index.js --name "insight-education"
   ```

---

## 📄 License
MIT License

**Developed by [Rishu Rajak](https://github.com/r1shurajak)** · EduNextG
