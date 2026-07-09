import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const activeTextEntries = [
	"src",
	"cli",
	"README.md",
	"CONFIG.MD",
	"GAME.MD",
	"index.html",
	"@chat-gpt/README.md",
	"package.json",
	"tsconfig.json",
	"vite.config.ts",
	"vitest.config.ts",
	".dependency-cruiser.cjs",
] as const;

const excludedTextPathPrefixes = [
	"cli/repo/audit/",
] as const;

const excludedTextPaths = new Set([
	"cli/repo/auditCurrent.ts",
]);

export const readActiveTextFiles = () =>
	activeTextEntries
		.flatMap((entry) =>
			statSync(entry).isDirectory()
				? readFiles(entry)
				: [
						entry,
					],
		)
		.filter((path) => /\.(?:cjs|css|json|md|ts|tsx)$/.test(path))
		.filter((path) => !excludedTextPaths.has(path))
		.filter((path) => !excludedTextPathPrefixes.some((prefix) => path.startsWith(prefix)));

export const readFiles = (root: string): string[] => {
	const entries = readdirSync(root, {
		withFileTypes: true,
	});

	return entries.flatMap((entry) => {
		const path = join(root, entry.name);
		if (entry.isDirectory()) return readFiles(path);
		if (!entry.isFile()) return [];
		return [
			relative(process.cwd(), path),
		];
	});
};
