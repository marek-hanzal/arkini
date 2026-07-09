import { existsSync, readFileSync } from "node:fs";
import type { AuditFinding } from "./AuditFinding";
import { readActiveTextFiles } from "./readAuditFiles";

const forbiddenDirectories = [
	"src/v0",
	"src/game",
	"src/ancient",
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

export const auditForbiddenDirectories = (): AuditFinding[] =>
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

export const auditText = (): AuditFinding[] =>
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
