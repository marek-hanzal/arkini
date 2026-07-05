import { readFileSync } from "node:fs";
import type { AuditFinding } from "./AuditFinding";
import { readFiles } from "./readAuditFiles";

export const auditRedundantSchemaTypeAliases = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		const text = readFileSync(path, "utf8");
		const findings: AuditFinding[] = [];
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

export const auditImpureIdGenerationBoundaries = (): AuditFinding[] =>
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

export const auditEffectRunnerBoundaries = (): AuditFinding[] =>
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
