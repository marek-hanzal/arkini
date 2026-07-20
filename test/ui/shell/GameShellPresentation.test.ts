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
		expect(styles).toContain('[data-ui="GameShell"] {');
		expect(styles).toContain("background-image: var(--ak-game-shell-background);");
		expect(styles).toContain('[data-ui="GameShell"]::before {');
		expect(styles).toContain("background-image: var(--ak-game-shell-background-ambient);");
		expect(styles).toContain(
			"animation: ak-game-shell-ambient-crossfade 48s ease-in-out infinite;",
		);
		expect(styles).toContain("pointer-events: none;");
		expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
		expect(styles).toContain("animation: none;");
	});

	it("gives Board and Toolbar distinct semantic surface depth", () => {
		expect(styles).toContain("--shadow-board-surface: var(--ak-board-surface-shadow);");
		expect(styles).toContain("--shadow-toolbar-surface: var(--ak-toolbar-surface-shadow);");
		expect(styles).toContain("--ak-board-surface-shadow:");
		expect(styles).toContain("--ak-toolbar-surface-shadow:");
		expect(styles).toContain('[data-ui="BoardFrame"] {');
		expect(styles).toContain("box-shadow: var(--ak-board-surface-shadow);");
		expect(styles).toContain('[data-ui="Toolbar"] {');
		expect(styles).toContain("box-shadow: var(--ak-toolbar-surface-shadow);");
		expect(styles).not.toMatch(/\[data-tile-grid-frame="true"\]\s*\{[^}]*box-shadow:/);
	});
});
