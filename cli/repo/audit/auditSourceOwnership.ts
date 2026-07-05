import { readFileSync } from "node:fs";
import type { AuditFinding } from "./AuditFinding";
import { readFiles } from "./readAuditFiles";

export const auditIndexBarrels = (): AuditFinding[] =>
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

export const auditForbiddenLogicDirectories = (): AuditFinding[] =>
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

export const auditEffectFunctionNames = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (!/\.tsx?$/.test(path)) return [];
		const text = readFileSync(path, "utf8");
		const findings: AuditFinding[] = [];
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
