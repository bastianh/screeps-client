// Rewires peer-dependency symlinks for local development.
// When xxscreeps-mod-client is symlinked into another pnpm workspace (e.g. xxscreeps),
// Node ESM follows the real path and would pick up the pnpm-resolved xxscreeps@0.1.0
// instead of the host workspace's version, causing hooks to be registered on a different
// instance than the server uses. This script redirects the symlink to the local workspace.
import { unlinkSync, symlinkSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const xxscreepsWorkspace = resolve(root, '../xxscreeps/packages/xxscreeps');
const symlink = resolve(root, 'xxscreeps-mod-client/node_modules/xxscreeps');

if (!existsSync(xxscreepsWorkspace)) process.exit(0);

mkdirSync(dirname(symlink), { recursive: true });
try { unlinkSync(symlink); } catch { /* already gone */ }
symlinkSync(xxscreepsWorkspace, symlink);
console.log(`[fix-dev-links] xxscreeps-mod-client/node_modules/xxscreeps → local workspace`);
