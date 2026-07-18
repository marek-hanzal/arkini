// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderLayout = async (props: Omit<MainPageLayout.Props, "children">) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				MainPageLayout,
				props,
				createElement("div", {
					"data-ui": "TestMainPageContent",
				}),
			),
		);
	});
	return container;
};

describe("MainPageLayout", () => {
	it("keeps Hero and content in stable main-page slots without a nested Hero snapshot", async () => {
		const container = await renderLayout({
			page: "settings",
		});
		const layout = container.querySelector<HTMLElement>('[data-ui="LauncherSceneLayout"]');
		const heroSlot = container.querySelector<HTMLElement>('[data-ui="LauncherSceneHeroSlot"]');
		const contentSlot = container.querySelector<HTMLElement>(
			'[data-ui="LauncherSceneContentSlot"]',
		);
		const hero = container.querySelector<HTMLElement>('[data-ui="LauncherHero"]');
		const panel = container.querySelector<HTMLElement>('[data-ui="MainPagePanel"]');

		expect(layout?.dataset.layout).toBe("fixed-hero");
		expect(layout?.style.gridTemplateRows).toBe("minmax(0, 2fr) minmax(0, 3fr)");
		expect(hero?.parentElement).toBe(heroSlot);
		expect(panel?.parentElement).toBe(contentSlot);
		expect(hero?.style.viewTransitionName).toBe("");
		expect(panel?.style.viewTransitionName).toBe("arkini-main-page-panel");
	});

	it("keeps the same outer slots for the viewport catalog without morphing its panel", async () => {
		const container = await renderLayout({
			page: "arkpacks",
			panelMode: "viewport",
			transitionPanel: false,
		});
		const layout = container.querySelector<HTMLElement>('[data-ui="LauncherSceneLayout"]');
		const heroSlot = container.querySelector<HTMLElement>('[data-ui="LauncherSceneHeroSlot"]');
		const contentSlot = container.querySelector<HTMLElement>(
			'[data-ui="LauncherSceneContentSlot"]',
		);
		const hero = container.querySelector<HTMLElement>('[data-ui="LauncherHero"]');
		const panel = container.querySelector<HTMLElement>('[data-ui="MainPagePanel"]');

		expect(layout?.dataset.layout).toBe("fixed-hero");
		expect(hero?.parentElement).toBe(heroSlot);
		expect(panel?.parentElement).toBe(contentSlot);
		expect(panel?.className).toContain("flex-1");
		expect(panel?.style.viewTransitionName).toBe("");
	});
});
