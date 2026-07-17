import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppearanceContext } from "~/ui/appearance/AppearanceContext";
import { AppearanceControl } from "~/ui/appearance/AppearanceControl";

const renderAppearanceControl = ({
	theme,
	switching = false,
}: {
	readonly theme: "dark" | "light" | "system";
	readonly switching?: boolean;
}) =>
	renderToStaticMarkup(
		createElement(AppearanceContext.Provider, {
			value: {
				theme,
				switching,
				setTheme: () => undefined,
			},
			children: createElement(AppearanceControl),
		}),
	);

describe("AppearanceControl", () => {
	it("renders every supported theme and preserves the selected value", () => {
		const html = renderAppearanceControl({
			theme: "system",
		});

		expect(html).toContain('value="dark"');
		expect(html).toContain('value="light"');
		expect(html).toContain('value="system" selected=""');
	});

	it("disables theme changes while a preference switch is in flight", () => {
		expect(
			renderAppearanceControl({
				theme: "dark",
				switching: true,
			}),
		).toContain('disabled=""');
	});
});
