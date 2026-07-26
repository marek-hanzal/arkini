import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../../../src/ui/styles.css", import.meta.url), "utf8");

describe("Game shell presentation", () => {
	it("owns one static solid background for the complete game shell", () => {
		expect(styles).toContain("--ak-game-shell-background: light-dark(#e7d8ee, #24142f);");
		expect(styles).toContain('[data-ui="GameShell"] {');
		expect(styles).toContain("background-color: var(--ak-game-shell-background);");
		expect(styles).not.toContain("--ak-game-shell-background-ambient:");
		expect(styles).not.toContain("--ak-game-shell-intro-delay:");
		expect(styles).not.toContain('[data-ui="GameShell"]::before');
		expect(styles).not.toContain('[data-ui="GameShell"]::after');
	});
});
