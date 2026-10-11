import { statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const sourceRoot = new URL('../src/', import.meta.url);
const databaseUrl = new URL('../src/lib/infra/db/index.ts', import.meta.url).href;
const mockDatabaseUrl = new URL('./helpers/database.mjs', import.meta.url).href;

registerHooks({
	resolve(specifier, context, nextResolve) {
		let candidate;
		if (specifier.startsWith('$lib/')) {
			candidate = new URL(`lib/${specifier.slice(5)}`, sourceRoot);
		} else if (specifier.startsWith('.') && context.parentURL?.startsWith(sourceRoot.href)) {
			candidate = new URL(specifier, context.parentURL);
		}

		if (candidate) {
			for (const suffix of ['', '.ts', '/index.ts']) {
				const url = new URL(candidate.href + suffix);
				if (statSync(fileURLToPath(url), { throwIfNoEntry: false })?.isFile()) {
					specifier = url.href;
					break;
				}
			}
		}
		const resolved = nextResolve(specifier, context);
		return resolved.url === databaseUrl ? { ...resolved, url: mockDatabaseUrl } : resolved;
	}
});
