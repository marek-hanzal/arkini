import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../../../src/ui/styles.css", import.meta.url), "utf8");
const arkpackSelector = readFileSync(
	new URL("../../../src/ui/arkpack/ArkpackSelector.tsx", import.meta.url),
	"utf8",
);
const toolbar = readFileSync(
	new URL("../../../src/ui/toolbar/Toolbar.tsx", import.meta.url),
	"utf8",
);

describe("global scrollbar presentation", () => {
	it("owns one semantic native scrollbar treatment at the renderer style boundary", () => {
		expect(styles).toContain("--ak-scrollbar-size: 0.625rem;");
		expect(styles).toContain("--ak-scrollbar-track: light-dark(");
		expect(styles).toContain("--ak-scrollbar-thumb: light-dark(");
		expect(styles).toContain("--ak-scrollbar-thumb-hover: light-dark(");
		expect(styles).toContain("--ak-scrollbar-thumb-active: light-dark(");
		expect(styles).toContain("--ak-scrollbar-track-border: light-dark(");
		expect(styles).toContain("--ak-scrollbar-corner: var(--ak-scrollbar-track);");
		expect(styles).toContain("@media (forced-colors: none)");
		expect(styles).toContain(
			"scrollbar-color: var(--ak-scrollbar-thumb) var(--ak-scrollbar-track);",
		);
		expect(styles).toContain("scrollbar-width: thin;");
		expect(styles).toContain("*::-webkit-scrollbar {");
		expect(styles).toContain("width: var(--ak-scrollbar-size);");
		expect(styles).toContain("height: var(--ak-scrollbar-size);");
		expect(styles).toContain("*::-webkit-scrollbar-thumb:hover {");
		expect(styles).toContain("*::-webkit-scrollbar-thumb:active {");
		expect(styles).toContain("*::-webkit-scrollbar-corner {");
	});

	it("shows ordinary catalog overflow while retaining only the explicit Toolbar opt-out", () => {
		expect(arkpackSelector).toContain("overflow-y-auto overscroll-contain");
		expect(arkpackSelector).not.toContain("scrollbar-hidden");
		expect(toolbar).toContain("overflow-x-auto overflow-y-hidden scrollbar-hidden");
		expect(styles).toContain(".scrollbar-hidden {");
		expect(styles).toContain("scrollbar-width: none;");
	});
});
