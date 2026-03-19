# Agent Manager

A full-stack web application for managing AI agents and Model Context Protocol (MCP) servers, with built-in user management, role-based access control (RBAC), and a self-hosted MCP server endpoint.

## Features

- **User Management** — Create, update, delete users and assign roles
- **Role-Based Access Control** — Manage roles with fine-grained permissions per resource/action
- **AI Agent Management** — Create and configure markdown-based agents (primary or subagent modes) with tool bindings
- **MCP Server Integration** — Register and manage external MCP servers (HTTP and stdio types)
- **Role-Agent/MCP Mapping** — Assign agents and MCP servers to roles
- **JWT Authentication** — Secure login with Passport.js and JSON Web Tokens
- **Dual Server Architecture** — API server + MCP server running independently

---

## Tech Stack

### Backend
| Tech | Version | Purpose |
|------|---------|---------|
| Node.js + Express 5 | 5.2.1 | HTTP API server |
| TypeScript | 5.5 | Type-safe backend |
| SQLite + Drizzle ORM | 0.45.1 | Database and migrations |
| Passport.js + JWT | — | Authentication |
| Zod | 4.3.6 | Input validation |
| @modelcontextprotocol/sdk | 1.27.1 | MCP protocol server |
| Winston | 3.19.0 | Logging |
| bcryptjs | 3.0.3 | Password hashing |

### Frontend
| Tech | Version | Purpose |
|------|---------|---------|
| Vue 3 | 3.4.0 | UI framework |
| Vite | 5.4.0 | Build tool and dev server |
| TypeScript | 5.5 | Type-safe frontend |
| Vue Router | 4.3.0 | Client-side routing |
| Pinia | 2.1.0 | State management |
| Tailwind CSS | 4.0.0 | Utility-first styling |

---

## Project Structure

```
agent-manager/
├── backend/
│   ├── src/
│   │   ├── application/        # Routes, use cases, services
│   │   │   ├── routes/         # Express route definitions
│   │   │   ├── use-cases/      # Business logic (CQRS-style)
│   │   │   └── services/       # Shared application services
│   │   ├── domain/             # Entities and repository interfaces
│   │   ├── infra/              # Database, repositories, external services
│   │   │   ├── db/             # Schema and database connection
│   │   │   ├── repository/     # Concrete repository implementations
│   │   │   └── service/        # Passport, OAuth, MCP, Logger
│   │   ├── container.ts        # Dependency injection container
│   │   ├── envs.ts             # Environment variable parsing
│   │   └── index.ts            # Entry point
│   └── drizzle/                # Auto-generated DB migrations
├── frontend/
│   ├── src/
│   │   ├── views/              # Page components (Login, Users, Roles, Agents, MCPs)
│   │   ├── components/         # Reusable UI components
│   │   ├── api/                # API client wrappers
│   │   ├── router/             # Vue Router with auth guards
│   │   ├── store/              # Pinia stores (auth, toasts)
│   │   └── types/              # Shared TypeScript interfaces
│   ├── vite.config.ts
│   └── package.json
├── data/                       # Runtime data (SQLite DB, repos) — gitignored
├── drizzle.config.ts
├── mcp.json                    # MCP server configuration
├── package.json                # Root workspace
└── .env                        # Environment variables
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd agent-manager

# Install all workspace dependencies (root + backend + frontend)
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# API Server
SERVER_PORT=3200
SERVER_URL=http://localhost:3200
SERVER_API_PATH=/api
SERVER_DATA_PATH=./data

# MCP Server
MCP_PORT=3201

# Frontend (Vite)
VITE_SERVER_URL=http://localhost:3200
VITE_SERVER_API_PATH=/api

# Agent configuration (optional)
AGENT_MODEL=
AGENT_BASE_URL=
AGENT_KEY=
```

### Database Setup

```bash
# Apply all migrations
npm run db:migrate

# Seed initial authentication data (admin user, roles, permissions)
npm run db:seed
```

### Development

```bash
# Run backend and frontend concurrently
npm run dev

# Or run them separately
npm run server:dev   # Backend API on http://localhost:3200
npm run ui:dev       # Frontend on http://localhost:5173 (proxies /api to backend)
```

### Production Build

```bash
# Build both backend and frontend
npm run build

# Start production server (serves API + compiled frontend)
npm run server:start
```

---

## Database

- **Engine**: SQLite (no external database required)
- **ORM**: Drizzle ORM with full type safety
- **Location**: `./data/agent-manager.db` (configurable via `SERVER_DATA_PATH`)
- **WAL mode** enabled for better concurrent read performance

### Schema Overview

| Table | Description |
|-------|-------------|
| `users` | User accounts with hashed passwords |
| `roles` | Role definitions |
| `permissions` | Fine-grained permissions (resource + action) |
| `user_roles` | Users ↔ Roles (many-to-many) |
| `role_permissions` | Roles ↔ Permissions (many-to-many) |
| `agents` | AI agent definitions (markdown-based) |
| `agent_subagents` | Agent hierarchy (self-referential many-to-many) |
| `mcp_servers` | External MCP server registrations |
| `role_mcps` | Roles ↔ MCP Servers (many-to-many) |
| `role_agents` | Roles ↔ Agents (many-to-many) |

### Database Scripts

```bash
npm run db:migrate    # Run pending migrations
npm run db:seed       # Seed initial data
npm run db:generate   # Generate new migration from schema changes
```

---

## API Reference

**Base URL**: `http://localhost:3200/api`
**Authentication**: `Authorization: Bearer <JWT_TOKEN>`

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Login and receive JWT token |
| `GET` | `/auth/me` | Get current user profile |
| `POST` | `/auth/check-permission` | Verify user permission |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users` | List all users |
| `GET` | `/users/:id` | Get user by ID |
| `POST` | `/users/register` | Create user |
| `PUT` | `/users/:id` | Update user |
| `DELETE` | `/users/:id` | Delete user |
| `POST` | `/users/:userId/roles/:roleId` | Assign role to user |
| `DELETE` | `/users/:userId/roles/:roleId` | Remove role from user |

### Roles

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/roles` | List all roles |
| `GET` | `/roles/:id` | Get role by ID |
| `POST` | `/roles` | Create role |
| `PUT` | `/roles/:id` | Update role |
| `DELETE` | `/roles/:id` | Delete role |
| `POST` | `/roles/:roleId/permissions/:permissionId` | Assign permission to role |
| `DELETE` | `/roles/:roleId/permissions/:permissionId` | Remove permission from role |

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/:id` | Get agent by ID |
| `GET` | `/agents/tools` | List available tools |
| `POST` | `/agents` | Create agent |
| `PUT` | `/agents/:id` | Update agent |
| `DELETE` | `/agents/:id` | Delete agent |

### MCP Servers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/mcp-servers` | List MCP servers |
| `GET` | `/mcp-servers/:id` | Get MCP server by ID |
| `POST` | `/mcp-servers` | Register MCP server |
| `PUT` | `/mcp-servers/:id` | Update MCP server |
| `DELETE` | `/mcp-servers/:id` | Delete MCP server |
| `GET` | `/roles/:roleId/mcps` | Get MCP servers assigned to role |
| `POST` | `/roles/:roleId/mcps/:mcpServerId` | Assign MCP server to role |
| `DELETE` | `/roles/:roleId/mcps/:mcpServerId` | Remove MCP server from role |
| `GET` | `/roles/:roleId/agents` | Get agents assigned to role |
| `POST` | `/roles/:roleId/agents/:agentId` | Assign agent to role |
| `DELETE` | `/roles/:roleId/agents/:agentId` | Remove agent from role |

### MCP Protocol Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/mcp` | MCP streamable HTTP endpoint |
| `GET` | `/mcp/tools` | List available MCP tools |
| `GET` | `/mcp/prompts` | List available MCP prompts |
| `GET` | `/.well-known/oauth-authorization-server` | OAuth metadata |

---

## Architecture

The backend follows a **Clean Architecture / DDD** pattern with four layers:

```
┌──────────────────────────────────┐
│  Presentation  (Routes)          │  ← Express route handlers, input validation (Zod)
├──────────────────────────────────┤
│  Application   (Use Cases)       │  ← Business logic, orchestration
├──────────────────────────────────┤
│  Domain        (Entities/Repos)  │  ← Interfaces, value objects, domain rules
├──────────────────────────────────┤
│  Infrastructure (DB, Services)   │  ← Drizzle repos, Passport, MCP, Logger
└──────────────────────────────────┘
```

Key patterns used:
- **Repository Pattern** — Data access abstracted behind interfaces
- **Use Case Pattern** — One class per business operation
- **Dependency Injection** — `container.ts` wires all dependencies
- **Registry Pattern** — Dynamic route registration at startup

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start backend + frontend in watch/dev mode |
| `npm run build` | Build backend and frontend for production |
| `npm run server:dev` | Start backend in watch mode (tsx) |
| `npm run server:build` | Compile backend with tsc |
| `npm run server:start` | Run compiled backend |
| `npm run ui:dev` | Start Vite dev server |
| `npm run ui:build` | Build frontend assets |
| `npm run db:migrate` | Apply pending DB migrations |
| `npm run db:seed` | Seed initial data |
| `npm run db:generate` | Generate migration from schema changes |

---

## License

MIT
