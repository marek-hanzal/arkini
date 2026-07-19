import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../../../src/ui/styles.css", import.meta.url), "utf8");

describe("View Transition styles", () => {
	it("attaches typed selectors directly to native pseudo-elements", () => {
		expect(styles).not.toMatch(/:active-view-transition-type\([^)]*\)\s+::view-transition-/);
		expect(styles).toContain(
			":root:active-view-transition-type(hero-to-hero)::view-transition-old(",
		);
		expect(styles).toContain(
			":root:active-view-transition-type(startup-to-main-menu)::view-transition-group(",
		);
	});

	it("removes both root screenshots from explicit Arkini choreography", () => {
		expect(styles).toContain("::view-transition-group(root) {");
		expect(styles).toContain(
			":root:active-view-transition-type(arkini-route)::view-transition-old(root)",
		);
		expect(styles).toContain(
			":root:active-view-transition-type(arkini-route)::view-transition-new(root)",
		);
		expect(styles).not.toContain("arkini-vt-root-handoff");
		expect(styles).not.toContain("plus-lighter");
	});

	it("keeps GameMenu leave Hero raster stable through terminal launcher redirects", () => {
		expect(styles).toContain(
			":root:active-view-transition-type(board-to-settings)::view-transition-old(",
		);
		expect(styles).toContain(
			":root:active-view-transition-type(board-to-main-menu)::view-transition-old(",
		);
		expect(styles).toContain(
			":root:active-view-transition-type(board-to-settings)::view-transition-new(",
		);
		expect(styles).toContain(
			":root:active-view-transition-type(board-to-main-menu)::view-transition-new(",
		);
	});

	it("keeps page cards, action progress, and GameMenu on unrelated surfaces", () => {
		expect(styles).toContain("::view-transition-old(arkini-panel-main-menu)");
		expect(styles).toContain("::view-transition-new(arkini-panel-arkpacks)");
		expect(styles).toContain("::view-transition-old(arkini-action-progress)");
		expect(styles).toContain("::view-transition-old(arkini-game-menu-dialog)");
		expect(styles).not.toContain("arkini-route-panel");
		expect(styles).not.toContain("arkini-route-content");
	});
});
