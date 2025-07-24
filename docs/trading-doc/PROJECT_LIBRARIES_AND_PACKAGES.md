# Libraries, Packages, and Tooling Overview

This document provides a comprehensive overview of the libraries, packages, and key npm scripts used in the modular trading system. It explains the purpose and usage of each, organized by category, to help with onboarding, maintenance, and extensibility.

---

## 1. Core Libraries & Frameworks

- **express**: Web server framework for handling HTTP endpoints, webhooks, and internal APIs.
- **@nestjs/swagger, swagger-ui-express**: Tools for auto-generating and serving API documentation (used for internal API clarity, not public exposure).
- **eventemitter2**: Advanced event emitter for event-driven architecture and inter-module communication.

---

## 2. Utility Libraries

- **lodash**: Utility functions for data manipulation, deep cloning, and functional programming.
- **moment**: Date and time parsing, formatting, and manipulation.
- **mathjs, simple-statistics, ml-matrix**: Mathematical, statistical, and matrix operations for strategy logic and analytics.
- **open**: Opens URLs or files from the CLI (e.g., for OAuth flows or dashboards).
- **yamljs**: Parsing and working with YAML config files.
- **zod, convict, config**: Schema validation and configuration management for robust, type-safe configs.

---

## 3. Database & ORM

- **@prisma/client, prisma**: Prisma ORM for type-safe database access and migrations (PostgreSQL).
- **pg**: PostgreSQL driver for direct DB connections.

---

## 4. Caching & Messaging

- **ioredis, redis**: Redis clients for multi-level caching and pub/sub messaging.

---

## 5. API, Web, & Broker Integration

- **axios**: HTTP client for REST API calls (e.g., external data sources).
- **kiteconnect**: Official Zerodha Kite Connect API client for trading, market data, and authentication.
- **ngrok**: Exposes local webhooks to the internet for broker/webhook integration.
- **node-cron**: Scheduling recurring jobs (e.g., data fetch, health checks).
- **ws**: WebSocket client/server for real-time data and broker communication.
- **puppeteer**: Headless browser automation (e.g., for automated login flows).
- **speakeasy**: TOTP (Time-based One-Time Password) for 2FA and secure authentication.

---

## 6. CLI & Terminal Dashboard

- **blessed, blessed-contrib**: Terminal UI libraries for building interactive dashboards and CLI tools.

---

## 7. Logging & Monitoring

- **pino, pino-pretty**: High-performance logging with pretty-printing for development.
- **winston, winston-daily-rotate-file**: Flexible logging with file rotation for persistent logs.

---

## 8. Testing & Development Tools

- **jest, ts-jest**: Testing framework and TypeScript integration for unit, integration, and E2E tests.
- **@types/\***: TypeScript type definitions for various libraries.
- **postman-collection-generator**: Generates Postman collections for API testing (internal use).

---

## 9. TypeScript & Linting

- **typescript, ts-node, ts-node-dev**: TypeScript compiler and runtime for development and hot-reloading.
- **eslint, @typescript-eslint/\*:** Linting and static analysis for code quality and style.

---

## 10. Build & Release

- **standard-version**: Automated versioning and changelog generation for releases.

---

## 11. Other Tools

- **dotenv**: Loads environment variables from .env files for config management.

---

## 12. Key npm Scripts

- **build, dev, start**: Compile, run in development, or start the production server.
- **test, test:watch, test:coverage, test:enhanced, test:all**: Run various test suites and coverage reports.
- **lint, lint:fix**: Run ESLint checks and auto-fix issues.
- **clean, prebuild**: Clean build artifacts before compiling.
- **watch**: Hot-reload server for development.
- **prisma:generate, prisma:migrate, prisma:studio**: Prisma ORM codegen, migrations, and DB GUI.
- **db:setup, db:reset, db:seed, db:check, db:test**: Database setup, reset, seeding, health checks, and integration tests.
- **tokens:all, trading:demo, trading:simple, trading:automated, trading:live**: Run various trading and token management example scripts.
- **dashboard**: Launch the terminal dashboard UI.
- **auth:example, webhook:start, error:demo, error:test, circuit:demo, circuit:test, security:demo, security:test, db:optimize:demo, db:optimize:test, cache:demo, cache:test**: Run example scripts and tests for specific modules.
- **release, changelog**: Manage releases and changelogs.

---

## 13. Summary

This document serves as a reference for all major libraries, packages, and scripts used in the trading system. It helps ensure maintainability, onboarding, and extensibility by clarifying the role and usage of each tool in the project.
