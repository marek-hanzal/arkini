import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../../../src/ui/styles.css", import.meta.url), "utf8");

describe("View Transition styles", () => {
	it("attaches typed selectors directly to native pseudo-elements", () => {
		expect(styles).not.toMatch(/:active-view-transition-type\([^)]*\)\s+::view-transition-/);
		expect(styles).toContain(
			":root:active-view-transition-type(startup-to-launcher)::view-transition-old(",
		);
		expect(styles).toContain(
			":root:active-view-transition-type(launcher-to-launcher)::view-transition-new(",
		);
	});

	it("keeps the root fallback opaque instead of using the browser cross-fade", () => {
		expect(styles).toContain("::view-transition-group(root) {");
		expect(styles).toContain("animation: arkini-vt-root-handoff 80ms linear both;");
		expect(styles).toContain("::view-transition-new(root) {");
		expect(styles).toContain("opacity: 1;");
		expect(styles).not.toContain("plus-lighter");
	});

	it("keeps panel chrome, page content, and action progress on separate surfaces", () => {
		expect(styles).toContain("::view-transition-old(arkini-startup-content)");
		expect(styles).toContain("::view-transition-old(arkini-route-panel)");
		expect(styles).toContain("::view-transition-old(arkini-route-content)");
		expect(styles).toContain("::view-transition-old(arkini-action-progress)");
		expect(styles).toContain(
			":root:active-view-transition-type(launcher-to-launcher)::view-transition-old(",
		);
	});
});
