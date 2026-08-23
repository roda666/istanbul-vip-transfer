/**
 * Compatibility launcher. The documented existing command remains:
 *   node scripts/generate-hero-images.mjs
 * The implementation is TypeScript so it can share the side-effect-free image
 * model, prompt configuration, and Sharp optimizer used by the admin pipeline.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./generate-hero-images.ts', import.meta.url));
const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', script, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
child.on('exit', code => { process.exitCode = code ?? 1; });
