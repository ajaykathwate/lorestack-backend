/**
 * pnpm isolates @prisma/client in its virtual store, which breaks Prisma's
 * .prisma/client type re-export. This script creates the missing junction so
 * TypeScript can resolve `@prisma/client` types correctly.
 */
import { existsSync, realpathSync, symlinkSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const nodeModules = join(root, 'node_modules');

// Resolve the real path of @prisma/client (follows junctions/symlinks)
const clientJunction = join(nodeModules, '@prisma', 'client');
if (!existsSync(clientJunction)) {
  console.log('fix-prisma-pnpm: @prisma/client not found, skipping.');
  process.exit(0);
}

const clientReal = realpathSync(clientJunction);
const dotPrismaTarget = join(clientReal, '..', '..', '.prisma');
const dotPrismaLink = join(clientReal, '.prisma');

if (!existsSync(dotPrismaTarget)) {
  console.log('fix-prisma-pnpm: .prisma store directory not found, skipping.');
  process.exit(0);
}

if (existsSync(dotPrismaLink)) {
  process.exit(0);
}

try {
  symlinkSync(dotPrismaTarget, dotPrismaLink, 'junction');
  console.log('fix-prisma-pnpm: created .prisma junction inside @prisma/client.');
} catch (err) {
  console.warn('fix-prisma-pnpm: could not create junction:', err.message);
}
