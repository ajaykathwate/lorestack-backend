import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const shouldSkip =
  process.env.CI === 'true' ||
  process.env.HUSKY === '0' ||
  process.env.DOCKER_BUILD === '1' ||
  !existsSync('.git') ||
  !existsSync(join('node_modules', 'husky'));

if (!shouldSkip) {
  const command = process.platform === 'win32' ? 'husky.cmd' : 'husky';
  const result = spawnSync(command, { stdio: 'inherit', shell: true });
  process.exit(result.status ?? 0);
}
