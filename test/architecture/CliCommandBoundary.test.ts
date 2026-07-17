import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };

const scripts = Object.entries(packageJson.scripts);

describe("canonical Effect CLI boundary", () => {
	it("keeps package aliases thin and never executes one operation file directly", () => {
		const directOperationEntrypoints = scripts.filter(([, command]) =>
			/tsx\s+cli\/.+Fx\.ts\b/.test(command),
		);
		const nonCanonicalCliEntrypoints = scripts.filter(
			([, command]) => /tsx\s+cli\//.test(command) && !command.includes("tsx cli/arkini.ts"),
		);
		const shellWorkflows = scripts.filter(([, command]) => command.includes("&&"));

		expect(directOperationEntrypoints).toEqual([]);
		expect(nonCanonicalCliEntrypoints).toEqual([]);
		expect(shellWorkflows).toEqual([]);
		expect(packageJson.scripts["package:mac"]).toBe(
			"tsx cli/arkini.ts desktop package --arch arm64",
		);
	});

	it("keeps local and GitHub packaging on the same canonical CLI alias", () => {
		const workflow = readFileSync(".github/workflows/macos-prerelease.yml", "utf8");
		expect(workflow).toContain("run: npm run package:mac");
		expect(packageJson.scripts["package:mac"]).toContain("cli/arkini.ts desktop package");
	});
});
