// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameLoadingScreen } from "~/ui/shell/GameLoadingScreen";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const renderScreen = async ({
	onComplete,
	ready,
}: {
	readonly onComplete?: () => void;
	readonly ready: boolean;
}) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(GameLoadingScreen, {
				onComplete,
				ready,
			}),
		);
	});
	return {
		container,
		root,
	};
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

describe("GameLoadingScreen", () => {
	it("advances through deterministic pending stages without claiming completion", async () => {
		const { container } = await renderScreen({
			ready: false,
		});
		const hero = container.querySelector<HTMLImageElement>('[data-ui="LauncherHero"]');
		expect(hero).not.toBeNull();
		expect(hero?.getAttribute("decoding")).toBe("sync");
		expect(hero?.style.viewTransitionName).toBe("arkini-launcher-hero");
		expect(
			container.querySelector<HTMLElement>('[data-ui="GameLoadingScreenPanel"]')?.style
				.viewTransitionName,
		).toBe("");
		expect(progressValue(container)).toBe(12);

		await act(async () => vi.advanceTimersByTime(180));
		expect(progressValue(container)).toBe(28);
		await act(async () => vi.advanceTimersByTime(240));
		expect(progressValue(container)).toBe(46);
		await act(async () => vi.advanceTimersByTime(10_000));
		expect(progressValue(container)).toBe(94);
	});

	it("shows 100 percent for the final hold before completing", async () => {
		const onComplete = vi.fn();
		const { container, root } = await renderScreen({
			onComplete,
			ready: false,
		});
		await act(async () => vi.advanceTimersByTime(780));
		expect(progressValue(container)).toBe(64);

		await act(async () => {
			root.render(
				createElement(GameLoadingScreen, {
					onComplete,
					ready: true,
				}),
			);
		});
		expect(progressValue(container)).toBe(100);
		await act(async () => vi.advanceTimersByTime(329));
		expect(onComplete).not.toHaveBeenCalled();
		await act(async () => vi.advanceTimersByTime(1));
		expect(onComplete).toHaveBeenCalledTimes(1);
	});

	it("cancels completion when the loading scene unmounts", async () => {
		const onComplete = vi.fn();
		const { root } = await renderScreen({
			onComplete,
			ready: true,
		});
		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		await act(async () => vi.advanceTimersByTime(1_000));
		expect(onComplete).not.toHaveBeenCalled();
	});

	it("keeps the final hold but skips interpolation for reduced motion", async () => {
		vi.mocked(window.matchMedia).mockReturnValue({
			matches: true,
		} as MediaQueryList);
		const onComplete = vi.fn();
		const { container } = await renderScreen({
			onComplete,
			ready: true,
		});
		expect(progressValue(container)).toBe(100);
		await act(async () => vi.advanceTimersByTime(149));
		expect(onComplete).not.toHaveBeenCalled();
		await act(async () => vi.advanceTimersByTime(1));
		expect(onComplete).toHaveBeenCalledTimes(1);
	});
});
