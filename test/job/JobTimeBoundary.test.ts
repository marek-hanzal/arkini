import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		return statSync(path).isDirectory()
			? readFiles(path)
			: [
					path,
				];
	});

describe("v1 job time boundary", () => {
	it("keeps jobs on remaining time and uses Effect Clock only through TickFx", () => {
		const files = readFiles("src/v1").filter((path) => path.endsWith(".ts"));
		const source = files.map((path) => readFileSync(path, "utf8")).join("\n");
		expect(source).not.toContain("startedAtMs");
		expect(source).not.toContain("dueAtMs");
		expect(source).not.toContain("pausedAtMs");
		expect(source).not.toContain("Date.now(");
		expect(files.some((path) => path.endsWith("pulseTickFx.ts"))).toBe(false);
		expect(readFileSync("src/v1/tick/context/TickFx.ts", "utf8")).not.toContain("readonly set");
	});
});
