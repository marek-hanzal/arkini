// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ActionLoadingScreen,
	defaultLoadingMinimumDurationMs,
} from "~/ui/loading/ActionLoadingScreen";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const renderScreen = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(ActionLoadingScreen, {
				label: "Loading test…",
			}),
		);
	});
	return container;
};

const progressValue = (container: ParentNode) =>
	Number(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"));

beforeEach(() => {
	vi.useFakeTimers();
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn(() => ({
			matches: false,
		})),
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("ActionLoadingScreen", () => {
	it("renders one native route surface and advances without claiming completion", async () => {
		const container = await renderScreen();
		const hero = container.querySelector<HTMLElement>('[data-ui="LauncherHero"]');
		const artwork = container.querySelector<HTMLElement>('[data-ui="LauncherHeroArtwork"]');
		expect(hero).not.toBeNull();
		expect(hero?.style.aspectRatio).toBe("3345 / 1882");
		expect(artwork).toBeInstanceOf(HTMLImageElement);
		expect(artwork?.getAttribute("alt")).toBe("Arkini");
		expect(artwork?.getAttribute("src")).toContain("hero.png");
		expect(hero?.style.viewTransitionName).toBe("");
		expect(artwork?.style.viewTransitionName).toBe("arkini-launcher-hero-artwork");
		expect(container.querySelector('[data-ui="LauncherHeroShadow"]')).not.toBeNull();
		expect(
			container.querySelector<HTMLElement>('[data-ui="ActionLoadingScreenPanel"]')?.style
				.viewTransitionName,
		).toBe("arkini-route-content");
		expect(container.textContent).toContain("Loading test…");
		expect(progressValue(container)).toBe(12);

		await act(async () => vi.advanceTimersByTime(defaultLoadingMinimumDurationMs));
		expect(progressValue(container)).toBe(94);
	});

	it("keeps a stable initial frame when reduced motion is requested", async () => {
		vi.mocked(window.matchMedia).mockReturnValue({
			matches: true,
		} as MediaQueryList);
		const container = await renderScreen();

		await act(async () => vi.advanceTimersByTime(defaultLoadingMinimumDurationMs * 2));
		expect(progressValue(container)).toBe(12);
	});
});
