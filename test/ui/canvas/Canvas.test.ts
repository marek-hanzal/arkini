// @vitest-environment jsdom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Canvas } from "~/ui/canvas/Canvas";

describe("Canvas", () => {
	it("owns one fixed size-container viewport for every renderer surface", () => {
		const html = renderToStaticMarkup(createElement(Canvas, null, createElement("main")));

		expect(html).toContain('data-ui="Canvas"');
		expect(html).toContain("container-type:size");
		expect(html).toContain("overflow-hidden");
	});
});
