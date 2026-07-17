import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppearanceContext } from "~/ui/appearance/AppearanceContext";
import { AppearanceControl } from "~/ui/appearance/AppearanceControl";

const renderAppearanceControl = ({
	theme,
	accent = "rose",
	switching = false,
}: {
	readonly theme: "dark" | "light" | "system";
	readonly accent?: "rose" | "violet" | "blue" | "green" | "amber";
	readonly switching?: boolean;
}) =>
	renderToStaticMarkup(
		createElement(AppearanceContext.Provider, {
			value: {
				theme,
				accent,
				switching,
				setTheme: () => undefined,
				setAccent: () => undefined,
				hydrate: () => undefined,
			},
			children: createElement(AppearanceControl),
		}),
	);

describe("AppearanceControl", () => {
	it("renders every supported theme and accent with selected values", () => {
		const html = renderAppearanceControl({
			theme: "system",
			accent: "blue",
		});

		expect(html).toContain('value="dark"');
		expect(html).toContain('value="light"');
		expect(html).toContain('value="system" selected=""');
		expect(html).toContain('value="rose"');
		expect(html).toContain('value="violet"');
		expect(html).toContain('value="blue" selected=""');
		expect(html).toContain('value="green"');
		expect(html).toContain('value="amber"');
	});

	it("disables appearance changes while a preference switch is in flight", () => {
		const html = renderAppearanceControl({
			theme: "dark",
			switching: true,
		});
		expect(html.match(/disabled=""/g)).toHaveLength(2);
	});
});
