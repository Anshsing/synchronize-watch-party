# ADR 001: Database Selection

**Date:** 2026-10-10
**Status:** Accepted

## Context
We needed a persistent storage solution for room metadata to survive server restarts, moving away from volatile in-memory objects.

## Decision
We chose **MongoDB** (via Mongoose) over PostgreSQL.

## Consequences
- Fast schema-less iteration.
- Easy integration with MongoDB Atlas for serverless deployment.
- Bypassed local CLI environmental issues with Prisma.
