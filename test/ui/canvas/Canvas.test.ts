import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Canvas } from "~/ui/canvas/Canvas";

describe("Canvas", () => {
	it("owns one overflow-hidden renderer viewport", () => {
		const html = renderToStaticMarkup(
			createElement(Canvas, null, createElement("span", null, "content")),
		);
		const styles = readFileSync("src/ui/styles.css", "utf8");

		expect(html).toContain('data-ui="Canvas"');
		expect(html).toContain("overflow-hidden");
		expect(styles).toMatch(/html,\s*body,\s*#root\s*\{[^}]*overflow:\s*hidden;/s);
	});
});
