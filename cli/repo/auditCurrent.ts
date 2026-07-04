#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { validateSources } from "../game/package";
import { loadGameConfigPackFromFile } from "../../src/config/pack/loadGameConfigPackFromFile";
import type { GameConfig } from "../../src/config/GameConfigTypes";

type Finding = {
	path: string;
	message: string;
};

const activeTextEntries = [
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

const excludedTextPaths = new Set([
	"cli/repo/auditCurrent.ts",
]);

const forbiddenDirectories = [
	"src/v0",
	"src/game",
	"src/ancient",
] as const;

const forbiddenRootConfigKeys = [
	"effects",
	"products",
	"merges",
	"merge",
	"producers",
	"stashes",
	"craftRecipes",
	"requirements",
] as const;

const forbiddenEmbeddedConfigKeys = [
	"productIds",
	"mergeIds",
	"craftRecipeId",
	"producerIds",
	"stashIds",
	"passiveEffectIds",
	"activatesEffectId",
	"defaultProductId",
	"defaultEffectProductId",
	"requirementId",
	"requirementIds",
] as const;

const forbiddenTextPatterns = [
	{
		label: "removed runtime namespace",
		pattern: /(?:^|[^\w])(?:src\/v0|~\/v0|src\/ancient|~\/ancient)(?:[^\w]|$)/,
	},
	{
		label: "removed source runtime bucket",
		pattern: /(?:^|[^\w])(?:src\/game|~\/game)(?:[^\w]|$)/,
	},
	{
		label: "removed persistence/cache marker",
		pattern: /\b(?:Kysely|SQLite|dbFx|withTransactionFx|React Query|react-query)\b/,
	},
	{
		label: "removed root config registry or field",
		pattern:
			/\b(?:craftRecipes|productIds|mergeIds|passiveEffectIds|activatesEffectId|defaultProductId|defaultEffectProductId|requirementIds?)\b/,
	},
] as const;

const main = async () => {
	const findings = [
		...auditForbiddenDirectories(),
		...auditText(),
		...auditIndexBarrels(),
		...auditEffectFunctionNames(),
		...auditRedundantSchemaTypeAliases(),
		...auditImpureIdGenerationBoundaries(),
		...auditConfig({
			config: await loadGameConfigPackFromFile("game/arkini.game.arkpack"),
			label: "game/arkini.game.arkpack",
		}),
		...auditConfig({
			config: await validateSources([
				"game/arkini",
			]),
			label: "game/arkini",
		}),
	];

	if (findings.length === 0) {
		console.log("Active codebase audit passed.");
		return;
	}

	console.error("Active codebase audit failed:");
	for (const finding of findings) {
		console.error(`  - ${finding.path}: ${finding.message}`);
	}
	process.exitCode = 1;
};

const auditForbiddenDirectories = (): Finding[] =>
	forbiddenDirectories.flatMap((path) =>
		existsSync(path)
			? [
					{
						path,
						message: "removed runtime directory must not exist",
					},
				]
			: [],
	);

const auditText = (): Finding[] =>
	readActiveTextFiles().flatMap((path) => {
		const text = readFileSync(path, "utf8");
		return forbiddenTextPatterns.flatMap(({ label, pattern }) =>
			pattern.test(text)
				? [
						{
							path,
							message: label,
						},
					]
				: [],
		);
	});

const auditIndexBarrels = (): Finding[] =>
	readFiles("src").flatMap((path) =>
		/(?:^|\/)index\.tsx?$/.test(path)
			? [
					{
						path,
						message:
							"catch-all barrel files hide ownership; import concrete modules directly",
					},
				]
			: [],
	);

const auditEffectFunctionNames = (): Finding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		const text = readFileSync(path, "utf8");
		const findings: Finding[] = [];
		const effectFnPattern = /export\s+const\s+(\w+)\s*=\s*Effect\.fn/g;
		for (const match of text.matchAll(effectFnPattern)) {
			const name = match[1];
			if (!name || name.endsWith("Fx")) continue;
			findings.push({
				path,
				message: `Effect function "${name}" must use the Fx suffix`,
			});
		}
		return findings;
	});

const auditRedundantSchemaTypeAliases = (): Finding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		const text = readFileSync(path, "utf8");
		const findings: Finding[] = [];
		const schemaTypeAliasPattern = /export\s+type\s+(\w+Schema)\s*=\s*typeof\s+\1\s*;/g;
		for (const match of text.matchAll(schemaTypeAliasPattern)) {
			const name = match[1];
			findings.push({
				path,
				message: `Schema type alias "${name}" is redundant; use the schema namespace Type`,
			});
		}
		return findings;
	});

const auditImpureIdGenerationBoundaries = (): Finding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		const text = readFileSync(path, "utf8");
		if (!text.includes('"@paralleldrive/cuid2"') && !text.includes("'@paralleldrive/cuid2'")) {
			return [];
		}
		if (/Fx\.tsx?$/.test(path)) return [];
		return [
			{
				path,
				message: "impure id generation must stay inside an Fx boundary",
			},
		];
	});

const auditConfig = ({ config, label }: { config: GameConfig; label: string }): Finding[] => {
	const findings: Finding[] = [];
	for (const key of Object.keys(config)) {
		if (!isForbiddenRootConfigKey(key)) continue;
		findings.push({
			path: `${label}.${key}`,
			message: "root registry key is not part of the embedded capability config model",
		});
	}

	findForbiddenConfigFields(config, label, findings);
	return findings;
};

const findForbiddenConfigFields = (value: unknown, path: string, findings: Finding[]) => {
	if (!value || typeof value !== "object") return;
	if (Array.isArray(value)) {
		for (const [index, entry] of value.entries()) {
			findForbiddenConfigFields(entry, `${path}[${index}]`, findings);
		}
		return;
	}

	for (const [key, entry] of Object.entries(value)) {
		if (isForbiddenEmbeddedConfigKey(key)) {
			findings.push({
				path: `${path}.${key}`,
				message: "removed config field is not part of the embedded capability model",
			});
		}
		findForbiddenConfigFields(entry, `${path}.${key}`, findings);
	}
};

const readActiveTextFiles = () =>
	activeTextEntries
		.flatMap((entry) =>
			statSync(entry).isDirectory()
				? readFiles(entry)
				: [
						entry,
					],
		)
		.filter((path) => /\.(?:cjs|css|json|md|ts|tsx)$/.test(path))
		.filter((path) => !excludedTextPaths.has(path));

const readFiles = (root: string): string[] => {
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

const isForbiddenRootConfigKey = (key: string): key is (typeof forbiddenRootConfigKeys)[number] =>
	(forbiddenRootConfigKeys as readonly string[]).includes(key);

const isForbiddenEmbeddedConfigKey = (
	key: string,
): key is (typeof forbiddenEmbeddedConfigKeys)[number] =>
	(forbiddenEmbeddedConfigKeys as readonly string[]).includes(key);

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
