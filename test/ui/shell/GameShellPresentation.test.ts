import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../../../src/ui/styles.css", import.meta.url), "utf8");

describe("Game shell presentation", () => {
	it("owns one semantic layered ambient background for the complete game shell", () => {
		expect(styles).toContain("--background-image-game-shell: var(--ak-game-shell-background);");
		expect(styles).toContain("--ak-game-shell-background:");
		expect(styles).toContain("--ak-game-shell-background-ambient:");
		expect(styles).toContain("--ak-game-shell-base-start: light-dark(");
		expect(styles).toContain("--ak-game-shell-base-end: light-dark(");
		expect(styles).toContain("--ak-game-shell-intro-delay: 2500ms;");
		expect(styles).toContain("--ak-game-shell-field-quaternary: light-dark(");
		expect(styles).toContain('[data-ui="GameShell"] {');
		expect(styles).toContain('[data-ui="GameShell"]::before,');
		expect(styles).toContain('[data-ui="GameShell"]::after {');
		expect(styles).toContain("background-image: var(--ak-game-shell-background-ambient);");
		expect(styles).toContain("background-image: var(--ak-game-shell-background);");
		expect(styles).toContain(
			"ak-game-shell-intro-fade-in var(--ak-game-shell-intro-duration) ease-out",
		);
		expect(styles).toContain(
			"ak-game-shell-ambient-fade-in var(--ak-game-shell-intro-duration) ease-out",
		);
		expect(styles).not.toContain("animation-iteration-count: infinite");
		expect(styles).toContain("z-index: -1;");
		expect(styles).toContain("pointer-events: none;");
		expect(styles).toContain("@keyframes ak-game-shell-intro-fade-in");
	});
});
