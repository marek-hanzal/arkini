import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
	readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

const styles = readSource("src/ui/styles.css");
const mainMenu = readSource("src/ui/launcher/MainMenu.tsx");
const gameMenu = readSource("src/ui/game-menu/GameMenu.tsx");
const settings = readSource("src/ui/settings/Settings.tsx");
const spotlight = readSource("src/ui/cheat-spotlight/CheatItemSpotlight.tsx");
const board = readSource("src/ui/board/Board.tsx");
const toolbar = readSource("src/ui/toolbar/Toolbar.tsx");
const lines = readSource("src/ui/item-detail/ItemLinesTab.tsx");
const sources = readSource("src/ui/item-detail/ItemSourcesTab.tsx");
const catalog = readSource("src/ui/arkpack/ArkpackCatalogList.tsx");

describe("semantic list-row presentation", () => {
	it("owns one plain list-row surface without zebra machinery", () => {
		expect(styles).toContain("--ak-list-row-surface: light-dark(");
		expect(styles).toContain("--ak-list-row-interactive-surface: light-dark(");
		expect(styles).toContain("--ak-list-row-selected-foreground: var(--ak-accent-contrast);");
		expect(styles).toContain(".ak-list-row {");
		expect(styles).toContain("background-color: var(--ak-list-row-surface);");
		expect(styles).toContain(".ak-list-row-interactive:focus-visible");
		expect(styles).toContain(".ak-list-row-interactive.ak-list-row-selected:focus-visible");
		expect(styles).toContain(".ak-list-row-pending {");
		expect(styles).toContain(".ak-list-row-active {");
		expect(styles).toContain(".ak-list-row-disabled,");
		expect(styles).not.toContain("--ak-list-row-surface-a:");
		expect(styles).not.toContain("--ak-list-row-surface-b:");
		expect(styles).not.toContain("nth-child(odd of .ak-list-row)");
		expect(styles).not.toContain("nth-child(even of .ak-list-row)");
		expect(styles).not.toContain("--ak-list-row-shadow:");
	});

	it("keeps list rows on genuine content while buttons, segmented options, and Spotlight own their states", () => {
		expect(lines).toContain('className="ak-list grid gap-1"');
		expect(lines).toContain("ak-list-row rounded-xl");
		expect(sources).toContain('className="ak-list grid gap-1"');
		expect(sources).toContain("ak-list-row border-b");
		expect(catalog).toContain('data-ui="ArkpackCatalogList"');
		expect(catalog).toContain("ak-list-row flex");
		expect(mainMenu).not.toContain("ak-list-row");
		expect(gameMenu).not.toContain("ak-list-row");
		expect(settings).toContain(
			'className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-raised/65 p-1"',
		);
		expect(settings).toContain("focus-within:ring-accent");
		expect(spotlight).toContain("ak-spotlight-option grid");
		expect(spotlight).toContain("ak-spotlight-option-secondary");
		expect(spotlight).not.toContain("ak-list-row");
		expect(board).not.toContain("ak-list-row");
		expect(toolbar).not.toContain("ak-list-row");
	});

	it("owns a complete Spotlight selected contrast pair and precedence", () => {
		expect(styles).toContain("--ak-spotlight-option-selected-surface: var(--ak-accent);");
		expect(styles).toContain(
			"--ak-spotlight-option-selected-foreground: var(--ak-accent-contrast);",
		);
		expect(styles).toContain("--ak-spotlight-option-selected-secondary: color-mix(");
		expect(styles).toContain('.ak-spotlight-option[data-selected="true"] {');
		expect(styles).toContain(
			'.ak-spotlight-option[data-selected="true"] .ak-spotlight-option-secondary',
		);
		expect(styles).toContain('.ak-spotlight-option[data-selected="true"]:focus-visible');
		expect(styles).toContain('.ak-spotlight-option[data-selected="true"]:not(:disabled):hover');
	});
});
