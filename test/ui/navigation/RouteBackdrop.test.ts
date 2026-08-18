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

		expect(html).toContain("view-transition-name:arkini-launcher-backdrop");
	});
});
