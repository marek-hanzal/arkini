import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../../../src/ui/styles.css", import.meta.url), "utf8");
const board = readFileSync(new URL("../../../src/ui/board/Board.tsx", import.meta.url), "utf8");
const toolbar = readFileSync(
	new URL("../../../src/ui/toolbar/Toolbar.tsx", import.meta.url),
	"utf8",
);
const lines = readFileSync(
	new URL("../../../src/ui/item-detail/ItemLinesTab.tsx", import.meta.url),
	"utf8",
);
const catalog = readFileSync(
	new URL("../../../src/ui/arkpack/ArkpackCatalogList.tsx", import.meta.url),
	"utf8",
);

describe("semantic list-row presentation", () => {
	it("owns one low-contrast zebra and interaction vocabulary at the global style boundary", () => {
		expect(styles).toContain("--ak-list-row-surface-a: light-dark(");
		expect(styles).toContain("--ak-list-row-surface-b: light-dark(");
		expect(styles).toContain("--ak-list-row-hover-surface: light-dark(");
		expect(styles).toContain("--ak-list-row-focus-surface: light-dark(");
		expect(styles).toContain("--ak-list-row-active-surface: light-dark(");
		expect(styles).toContain("--ak-list-row-selected-surface: var(--ak-accent);");
		expect(styles).toContain("--ak-list-row-shadow:");
		expect(styles).toContain("--ak-list-row-transition-duration: 140ms;");
		expect(styles).toContain(".ak-list > .ak-list-row:nth-child(odd of .ak-list-row)");
		expect(styles).toContain(".ak-list > .ak-list-row:nth-child(even of .ak-list-row)");
		expect(styles).toContain("@media (hover: hover) and (pointer: fine)");
		expect(styles).toContain("transform: translateY(-1px) scale(1.006);");
		expect(styles).toContain(".ak-list-row-interactive:focus-visible");
		expect(styles).toContain(".ak-list-row-interactive:focus-within");
		expect(styles).toContain(".ak-list-row-pending {");
		expect(styles).toContain(".ak-list-row-danger {");
		expect(styles).toContain(".ak-list-row-active {");
		expect(styles).toContain(".ak-list-row-selected {");
		expect(styles).toContain(".ak-list-row-interactive.ak-list-row-selected:focus-visible");
		expect(styles).toContain(".ak-list-row-interactive.ak-list-row-danger:focus-visible");
		expect(styles).toContain(".ak-list-row-disabled,");
		expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
	});

	it("applies the pattern to genuine lists without touching tile grids or nested line details", () => {
		expect(lines).toContain('className="ak-list grid gap-1"');
		expect(lines).toContain("ak-list-row rounded-xl");
		expect(lines).not.toContain('data-ui="TileLineInput"\n\t\t\t\t\tclassName="ak-list-row');
		expect(catalog).toContain('data-ui="ArkpackCatalogList"');
		expect(catalog).toContain("ak-list-row flex");
		expect(board).not.toContain("ak-list-row");
		expect(toolbar).not.toContain("ak-list-row");
	});
});
