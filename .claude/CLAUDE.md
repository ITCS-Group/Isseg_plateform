# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Integrated management and administration platform for the **Institut Supérieur des Sciences de l'Éducation de Guinée (ISSEG)** in Conakry. The platform handles student enrollment, pedagogy, grades, diplomas, LMS/Moodle integration, library, finance/HR, and system administration.

### Core Modules
- **Scolarité**: Enrollment (Parcoursup integration), document management, academic leaves, diploma processing
- **Pédagogie**: Note validation workflow (5-stage approval chain), course management, LMS integration
- **Bibliothèque**: Catalog management, loans (with regularity verification), digitization of theses/memoirs
- **Départements**: 4 departments (Sciences de l'Éducation, Didactique, Sciences du Langage, Sciences Sociales)
- **Innovation Numérique**: University publications (ISBN), pedagogical innovation center, IT support
- **Finance/RH**: Tuition fees, online payments, personnel management

## Monorepo Architecture (pnpm + Turborepo)

This is a monorepo managed with `pnpm workspaces` and `turbo` for orchestration.

### Workspace Structure

- **`apps/api`**: Main REST API (NestJS 10, Prisma ORM, JWT/RBAC authentication)
  - Entry point: `src/main.ts`
  - Authentication with refresh token rotation and secure cookie handling
  - Swagger UI available at `/api/docs` (non-production only)
  - Global API prefix: `/api/v1`
  - Modules: `auth`, `identity` (users/roles/permissions), `common` (guards/filters/decorators)

- **`apps/web`**: Frontend web application (React, Vite, TailwindCSS)
  - Single portal for all user roles

- **`apps/worker`**: Asynchronous job processing (BullMQ/Redis)
  - PDF/Excel generation, SMS/Email gateway

- **`services/moodle-service`**: Moodle LMS synchronization microservice
  - Bidirectional integration with Moodle

- **`packages/shared`**: Shared code (Types, DTOs)
- **`packages/ui`**: Shared React components
- **`packages/config`**: Common configurations

## Development Commands

### Running the Project

```bash
# Start all services in development mode
pnpm dev

# Start specific workspace
pnpm --filter api dev        # Backend API only
pnpm --filter web dev        # Frontend only
pnpm --filter worker dev     # Worker service only
```

### Database Management (Prisma)

```bash
# Apply migrations
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" pnpm --filter api prisma migrate dev

# Generate Prisma Client after schema changes
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" pnpm --filter api prisma generate

# Open Prisma Studio (DB GUI)
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" pnpm --filter api prisma studio

# Seed database with initial admin user
DATABASE_URL="postgresql://abdoul:azerty@localhost:5432/isseg?schema=public" ADMIN_EMAIL="admin@isseg.local" ADMIN_PASSWORD="Admin123!Secure" pnpm --filter api seed
```

**Important**: The database connection requires `DATABASE_URL` environment variable. The default credentials are `abdoul:azerty@localhost:5432/isseg`.

**Seeded roles & test accounts**: the seed also creates the 4 application roles already
referenced by `@Roles()` guards in the code — `SCOLARITE`, `ENSEIGNANT`,
`CHEF_DEPARTEMENT`, `RESPONSABLE_PEDAGOGIQUE` — with minimal permissions
(`MANAGE_DOSSIER_INSCRIPTION`, `READ_PEDAGOGIE`, `MANAGE_PEDAGOGIE`), plus one test
account per role: `{role}@isseg.local` (e.g. `scolarite@isseg.local`), shared temporary
password `ChangeMe123!` — rotate before any real-world use, never rely on it outside
dev/test environments. Seed is idempotent (safe to re-run).

### Build & Quality

```bash
# Build all workspaces
pnpm build

# Lint all code
pnpm lint
```

### Docker Environment

```bash
# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d postgres redis

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api
```

## RBAC (Role-Based Access Control)

The platform implements fine-grained RBAC with these primary roles:

### Administrative Roles
- **ADMIN / SUPER_ADMIN**: Full system access, user/role/permission management, system maintenance
- **SCOLARITE**: Student enrollment (Parcoursup integration, INE/matricule management), document validation, timetables, diploma issuance, academic leave processing
- **COMPTABLE / RH**: Finance management, online payments, personnel management

### Academic Roles
- **ENSEIGNANT**: Course design, grade entry for assigned courses, LMS sync
- **CHEF_DEPARTEMENT**: Note validation (first stage), section management, program oversight for their department
- **RESPONSABLE_PEDAGOGIQUE**: Course validation and publishing, note validation (Commission Pédagogique stage)
- **DIRECTEUR_GENERAL**: Final note validation (Grand Conseil stage)

### Innovation & Support Roles
- **DIRECTEUR_INNOVATION**: Pedagogical innovation center management, certificate program oversight
- **RESPONSABLE_PUBLICATIONS**: University publications, ISBN attribution, validation committee
- **RESPONSABLE_IT**: IT support request management, equipment tracking

### Student & Parent Roles
- **ETUDIANT**: Profile access, online courses, assignment submission, grade consultation, document requests
- **PARENT**: Student attendance/results consultation, administration contact

### Library Roles
- **BIBLIOTHECAIRE**: Catalog management, loan processing, subscription management
- **RESPONSABLE_NUMERISATION**: Digitization of theses and memoirs, metadata management

## Authentication Architecture

- **Access tokens**: Short-lived JWT (15 min default), passed in `Authorization: Bearer <token>` header
- **Refresh tokens**: Long-lived (7 days default), stored in secure HTTP-only cookie
- **Token rotation**: Each refresh generates new refresh token and revokes old one
- **Security features**: Account lockout after failed attempts, audit logging, token revocation

## Critical Workflows

### 5-Stage Note Validation Workflow

All grades submitted by teachers must pass through this validation chain before being finalized:

1. **Section** (Enseignant/Section Head)
   - Initial grade entry by the teacher
   - Section-level verification and approval

2. **Comité de Programme** (Program Committee)
   - Review of grades for program consistency
   - Cross-section validation

3. **Conseil de Département** (Department Council - Chef de Département)
   - Department head reviews and validates grades
   - Ensures alignment with department standards

4. **Commission Pédagogique** (Pedagogical Commission - Responsable Pédagogique)
   - Pedagogical oversight and validation
   - Quality assurance across all departments

5. **Grand Conseil** (Grand Council - Directeur Général)
   - Final institutional approval
   - Official publication of grades

**Important**: Each stage requires explicit approval and generates audit trail. Grades cannot be modified once validated at a given stage without going through a formal correction workflow.

### Parcoursup Integration (Enrollment)

The platform integrates with France's national enrollment system:

- **INE (Identifiant National Étudiant)**: Students from Parcoursup have an INE number
- **Matricule ISSEG**: Locally enrolled students receive an ISSEG matricule
- **Dual tracking**: System must handle both identifier types and map them appropriately
- **Data synchronization**: Enrollment data is imported from Parcoursup for registered students

## Key Integration Points

### Scolarité ↔ Bibliothèque
The Library module must call the Scolarité API to verify student regularity before allowing loans:
```
GET /api/v1/students/:matricule/regularity-status
```
Returns: `{ isRegular: boolean, reason?: string, lastPaymentDate?: Date }`

### Pédagogie ↔ Moodle Service
Heavy synchronization operations should be delegated to `services/moodle-service` to avoid blocking the main API.

### Scolarité ↔ Parcoursup
- Import enrollment data via Parcoursup API integration
- Map INE to ISSEG matricule
- Handle dual identifier system for student tracking

### Départements ↔ Pédagogie
- Department heads validate grades for their sections
- Validation workflow status must be tracked at each stage
- Audit trail required for all validation actions

### Innovation ↔ External Services
- ISBN API for university publications
- LMS platform integration (currently Google Workspace, migration to Moodle planned)
- IT support ticketing system integration

## Domain-Specific Context Files

For work on specific modules, refer to these context files:
- Scolarité & Enrollment: `.claude/agent-scolarite.md`
- Pédagogie, Grades & LMS: `.claude/agent-pedagogie.md`
- Bibliothèque & Digitization: `.claude/agent-bibliotheque.md`
- Départements & Validation: `.claude/agent-departements.md`
- Innovation & Publications: `.claude/agent-innovation.md`
- DevOps & Infrastructure: `.claude/agent-devops.md`

## Environment Variables

Copy `.env.example` to `.env` and configure:
- Database credentials (`DATABASE_URL`)
- JWT secrets (generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- Admin credentials for seeding
- CORS origin for frontend

## API Documentation

When the API is running in development mode, Swagger UI is available at:
- UI: `http://localhost:3001/api/docs`
- JSON: `http://localhost:3001/api/docs-json`

## Business Rules & Constraints

### Student Regularity
- Students must be "regular" (fees paid, no administrative holds) to:
  - Borrow books from the library
  - Access online course materials
  - Submit assignments
  - Receive official transcripts or certificates

### Grade Validation
- Grades cannot skip validation stages
- Each validation stage must have explicit approval with timestamp and approver ID
- Corrections to validated grades require a formal amendment workflow
- Final grades (after Grand Conseil) trigger transcript generation

### Document Management
- All official documents (attestations, diplomas) must have:
  - Unique reference number
  - Digital signature trail
  - PDF archival copy
  - Audit log of issuance

### Library Loans
- Maximum 3 active loans per student
- Loan duration: 14 days (renewable once if no holds)
- Late returns trigger automatic notifications and account holds

## Important Notes

- **Package Manager**: This project uses `pnpm@9.0.0` (enforced via `packageManager` field)
- **Prisma Location**: Schema and migrations are in `apps/api/prisma/`
- **Shared Code**: Always consider if code belongs in `packages/*` before adding it to a specific app
- **Security**: All endpoints use validation (class-validator), DTOs must whitelist properties
- **Error Handling**: Global exception filter handles Prisma errors and HTTP exceptions
- **Data Isolation**: Multi-tenancy considerations for department-specific data
- **Audit Trail**: All mutations (create/update/delete) must be logged in AuditLog table
