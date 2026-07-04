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
		...auditForbiddenLogicDirectories(),
		...auditEffectFunctionNames(),
		...auditBoardItemRemovalBoundaries(),
		...auditJobRemovalBoundaries(),
		...auditJobWriteBoundaries(),
		...auditActiveEffectWriteBoundaries(),
		...auditRedundantSchemaTypeAliases(),
		...auditImpureIdGenerationBoundaries(),
		...auditEffectRunnerBoundaries(),
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
			if (!name) continue;
			if (!name.endsWith("Fx")) {
				findings.push({
					path,
					message: `Effect function "${name}" must use the Fx suffix`,
				});
			}
			if (/Fx\.tsx?$/.test(path)) continue;
			findings.push({
				path,
				message: `Exported Effect function "${name}" must live in an Fx-suffixed file`,
			});
		}
		return findings;
	});

const auditForbiddenLogicDirectories = (): Finding[] =>
	readFiles("src").flatMap((path) =>
		path.includes("/logic/")
			? [
					{
						path,
						message:
							"./logic folders split ownership by vague intent; use concrete domain Fx modules",
					},
				]
			: [],
	);

const auditBoardItemRemovalBoundaries = (): Finding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		if (/[.](?:test|spec)[.]tsx?$/.test(path)) return [];
		if (path === "src/board/removeBoardItemFromSaveFx.ts") return [];

		const text = readFileSync(path, "utf8");
		if (!/delete\s+[^;]*\.board\.items\s*\[/.test(text)) return [];

		return [
			{
				path,
				message:
					"board item removal must go through removeBoardItemFromSaveFx so runtime-state cleanup/preservation is explicit",
			},
		];
	});

const jobRemovalBoundaryPaths = new Set([
	"src/board/removeBoardItemRuntimeStateFx.ts",
	"src/craft/removeCraftJobFromSaveFx.ts",
	"src/job/removeItemSpawnJobFromSaveFx.ts",
	"src/producer/removeProducerJobFromSaveFx.ts",
]);

const auditJobRemovalBoundaries = (): Finding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		if (/[.](?:test|spec)[.]tsx?$/.test(path)) return [];
		if (jobRemovalBoundaryPaths.has(path)) return [];

		const text = readFileSync(path, "utf8");
		if (!/delete\s+[^;]*\.(?:producerJobs|craftJobs|itemSpawnJobs)\s*\[/.test(text)) {
			return [];
		}

		return [
			{
				path,
				message:
					"job removal must go through a named job-removal Fx boundary; board item runtime cleanup is the only cascade exception",
			},
		];
	});

const jobWriteBoundaryPaths = new Set([
	"src/craft/writeCraftJobToSaveFx.ts",
	"src/job/writeItemSpawnJobToSaveFx.ts",
	"src/producer/writeProducerJobToSaveFx.ts",
]);

const auditJobWriteBoundaries = (): Finding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		if (/[.](?:test|spec)[.]tsx?$/.test(path)) return [];
		if (jobWriteBoundaryPaths.has(path)) return [];

		const text = readFileSync(path, "utf8");
		if (!/\.(?:producerJobs|craftJobs|itemSpawnJobs)\s*\[[^\]]+\]\s*=/.test(text)) {
			return [];
		}

		return [
			{
				path,
				message:
					"job writes must go through named job-write Fx boundaries so lifecycle updates stay grepable",
			},
		];
	});

const activeEffectWriteBoundaryPaths = new Set([
	"src/effects/removeActiveEffectFromSaveFx.ts",
	"src/effects/writeActiveEffectToSaveFx.ts",
]);

const auditActiveEffectWriteBoundaries = (): Finding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		if (/[.](?:test|spec)[.]tsx?$/.test(path)) return [];
		if (activeEffectWriteBoundaryPaths.has(path)) return [];

		const text = readFileSync(path, "utf8");
		if (!/(?:delete\s+[^;]*\.activeEffects\s*\[|\.activeEffects\s*\[[^\]]+\]\s*=)/.test(text)) {
			return [];
		}

		return [
			{
				path,
				message:
					"active effect writes/removals must go through named Fx boundaries so effect lifecycle changes stay grepable",
			},
		];
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

const effectRunnerBoundaryPaths = new Set([
	"src/engine/runtime/runGameEngineEffect.ts",
	"src/play/runtime/runGameRuntimeEffect.ts",
]);

const auditEffectRunnerBoundaries = (): Finding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		if (effectRunnerBoundaryPaths.has(path)) return [];
		if (/[.](?:test|spec)[.]tsx?$/.test(path)) return [];

		const text = readFileSync(path, "utf8");
		if (!text.includes("Effect.runPromise")) return [];

		return [
			{
				path,
				message:
					"Effect programs must run through a named runtime runner at the UI/hook boundary",
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
