import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppSplashScreen } from "~/app/AppSplashScreen";

describe("AppSplashScreen", () => {
	it("renders the packaged game hero as the splash image", () => {
		const html = renderToStaticMarkup(<AppSplashScreen heroSrc="data:image/png;base64,hero" />);

		expect(html).toContain('data-ui="app splash"');
		expect(html).toContain('src="data:image/png;base64,hero"');
		expect(html).toContain('alt="Arkini"');
	});
});
