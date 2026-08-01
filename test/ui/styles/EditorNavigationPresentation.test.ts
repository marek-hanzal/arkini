import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../../../src/ui/styles.css", import.meta.url), "utf8");

describe("editor navigation presentation", () => {
	it("promotes the synchronously transitioning link over committed styling", () => {
		expect(styles).toContain(
			'.ak-editor-workspace-tab[aria-current="page"]:not([data-transitioning])',
		);
		expect(styles).toContain(
			".ak-editor-workspace-tabs .ak-editor-workspace-tab[data-transitioning]",
		);
		expect(styles).toContain("background-color: var(--ak-accent);");
		expect(styles).toContain("transition: none;");
	});
});
