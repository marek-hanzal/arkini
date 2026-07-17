import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppearanceContext } from "~/ui/appearance/AppearanceContext";
import { AppearanceControl } from "~/ui/appearance/AppearanceControl";

describe("AppearanceControl", () => {
	it("offers dark, light, and explicit system preference modes", () => {
		const html = renderToStaticMarkup(
			createElement(AppearanceContext.Provider, {
				value: {
					theme: "system",
					switching: false,
					setTheme: () => undefined,
				},
				children: createElement(AppearanceControl),
			}),
		);

		expect(html).toContain('data-ui="AppearanceControl"');
		expect(html).toContain('<option value="dark">Dark</option>');
		expect(html).toContain('<option value="light">Light</option>');
		expect(html).toContain('<option value="system" selected="">System</option>');
	});
});
