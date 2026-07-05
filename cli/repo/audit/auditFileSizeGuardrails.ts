import { readFileSync } from "node:fs";
import type { AuditFinding } from "./AuditFinding";
import { readFiles } from "./readAuditFiles";

const sourceProductionLineLimit = 400;
const sourceTestLineLimit = 1500;

export const auditFileSizeGuardrails = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		const lineCount = readFileSync(path, "utf8").split("\n").length;
		const limit = isTestFile(path) ? sourceTestLineLimit : sourceProductionLineLimit;
		if (lineCount <= limit) return [];

		return [
			{
				path,
				message: `file has ${lineCount} lines; split it before it turns back into a monolith (limit ${limit})`,
			},
		];
	});

const isTestFile = (path: string) =>
	/[.](?:test|spec)[.]tsx?$/.test(path) ||
	path.includes("/test/") ||
	path.endsWith("testSupport.ts");
