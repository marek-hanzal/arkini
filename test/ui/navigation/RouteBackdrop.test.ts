import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RouteBackdrop } from "~/ui/navigation/RouteBackdrop";

describe("RouteBackdrop", () => {
	it("gives every fullscreen background the shared native transition identity", () => {
		const html = renderToStaticMarkup(
			createElement(RouteBackdrop, {
				className: "test-backdrop",
				dataUi: "TestBackdrop",
			}),
		);

		expect(html).toContain('data-ui="TestBackdrop"');
		expect(html).toContain("view-transition-name:arkini-launcher-backdrop");
		expect(html).toContain('aria-hidden="true"');
	});

	it("owns the backdrop key across launcher, game, and standalone game routes", () => {
		const owners = [
			"../../../src/ui/launcher/LauncherScene.tsx",
			"../../../src/ui/shell/GameShell.tsx",
			"../../../src/ui/cheats/Cheats.tsx",
		];

		for (const owner of owners) {
			expect(readFileSync(new URL(owner, import.meta.url), "utf8")).toContain(
				"<RouteBackdrop",
			);
		}
	});
});
