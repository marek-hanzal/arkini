import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppSplashCrossfadeLayer } from "~/app/AppSplashCrossfadeLayer";
import { AppSplashScreen } from "~/app/AppSplashScreen";

describe("AppSplashScreen", () => {
	it("renders the packaged game hero as the splash image", () => {
		const html = renderToStaticMarkup(
			<AppSplashScreen
				fadeDurationMs={1500}
				heroSrc="data:image/png;base64,hero"
				phase="visible"
			/>,
		);

		expect(html).toContain('data-ui="app splash"');
		expect(html).toContain('src="data:image/png;base64,hero"');
		expect(html).toContain('alt="Arkini"');
	});

	it("fades the splash screen out during the crossfade phase", () => {
		const html = renderToStaticMarkup(
			<AppSplashScreen
				fadeDurationMs={1500}
				phase="fading"
			/>,
		);

		expect(html).toContain('data-state="fading"');
		expect(html).toContain("opacity-0");
		expect(html).toContain("transition-duration:1500ms");
	});
});

describe("AppSplashCrossfadeLayer", () => {
	it("keeps the board hidden while the splash screen is visible", () => {
		const html = renderToStaticMarkup(
			<AppSplashCrossfadeLayer
				fadeDurationMs={1500}
				phase="visible"
			>
				<main>Board</main>
			</AppSplashCrossfadeLayer>,
		);

		expect(html).toContain('data-ui="app board crossfade layer"');
		expect(html).toContain('data-state="visible"');
		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain("opacity-0");
	});

	it("fades the board in during the crossfade phase", () => {
		const html = renderToStaticMarkup(
			<AppSplashCrossfadeLayer
				fadeDurationMs={1500}
				phase="fading"
			>
				<main>Board</main>
			</AppSplashCrossfadeLayer>,
		);

		expect(html).toContain('data-state="fading"');
		expect(html).toContain("opacity-100");
		expect(html).toContain("transition-duration:1500ms");
	});
});
