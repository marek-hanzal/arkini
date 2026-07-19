// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ActionLoadingScreen,
	defaultLoadingCompletedHoldMs,
	defaultLoadingMinimumDurationMs,
} from "~/ui/loading/ActionLoadingScreen";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const deferred = () => {
	let resolve!: () => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<void>((nextResolve, nextReject) => {
		resolve = nextResolve;
		reject = nextReject;
	});
	return {
		promise,
		reject,
		resolve,
	};
};

const renderScreen = async ({
	action,
	completedHoldMs = defaultLoadingCompletedHoldMs,
	minimumDurationMs = defaultLoadingMinimumDurationMs,
	onComplete,
	onError,
}: {
	readonly action?: Promise<void>;
	readonly completedHoldMs?: number;
	readonly minimumDurationMs?: number;
	readonly onComplete?: () => void;
	readonly onError?: (error: unknown) => void;
}) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(ActionLoadingScreen, {
				action,
				completedHoldMs,
				label: "Loading test…",
				minimumDurationMs,
				onComplete,
				onError,
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

describe("ActionLoadingScreen", () => {
	it("advances through pending stages without claiming completion", async () => {
		const { container } = await renderScreen({});
		const hero = container.querySelector<HTMLElement>('[data-ui="LauncherHero"]');
		const artwork = container.querySelector<HTMLElement>('[data-ui="LauncherHeroArtwork"]');
		expect(hero).not.toBeNull();
		expect(hero?.style.aspectRatio).toBe("3345 / 1882");
		expect(artwork?.getAttribute("role")).toBe("img");
		expect(artwork?.getAttribute("aria-label")).toBe("Arkini");
		expect(artwork?.style.backgroundImage).toContain("hero.png");
		expect(hero?.style.viewTransitionName).toBe("");
		expect(artwork?.style.viewTransitionName).toBe("");
		expect(container.querySelector('[data-ui="LauncherHeroShadow"]')).not.toBeNull();
		expect(
			container.querySelector<HTMLElement>('[data-ui="ActionLoadingScreen"]')?.style
				.viewTransitionName,
		).toBe("arkini-route-scene");
		expect(container.textContent).toContain("Loading test…");
		expect(progressValue(container)).toBe(12);

		await act(async () => vi.advanceTimersByTime(200));
		expect(progressValue(container)).toBe(28);
		await act(async () => vi.advanceTimersByTime(300));
		expect(progressValue(container)).toBe(46);
		await act(async () => vi.advanceTimersByTime(10_000));
		expect(progressValue(container)).toBe(94);
	});

	it("waits for both the real action and minimum duration before completing", async () => {
		const action = deferred();
		const onComplete = vi.fn();
		const { container } = await renderScreen({
			action: action.promise,
			onComplete,
		});

		await act(async () => {
			action.resolve();
			await action.promise;
			vi.advanceTimersByTime(defaultLoadingMinimumDurationMs - 1);
			await Promise.resolve();
		});
		expect(progressValue(container)).not.toBe(100);
		expect(onComplete).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(1);
			await Promise.resolve();
		});
		expect(progressValue(container)).toBe(100);
		await act(async () => vi.advanceTimersByTime(179 + defaultLoadingCompletedHoldMs));
		expect(onComplete).not.toHaveBeenCalled();
		await act(async () => vi.advanceTimersByTime(1));
		expect(onComplete).toHaveBeenCalledOnce();
	});

	it("waits beyond the minimum duration while the real action is still pending", async () => {
		const action = deferred();
		const onComplete = vi.fn();
		const { container } = await renderScreen({
			action: action.promise,
			onComplete,
		});

		await act(async () => vi.advanceTimersByTime(4_000));
		expect(progressValue(container)).toBe(94);
		expect(onComplete).not.toHaveBeenCalled();

		await act(async () => {
			action.resolve();
			await action.promise;
			await Promise.resolve();
		});
		expect(progressValue(container)).toBe(100);
	});

	it("never displays a false completed state for failed work", async () => {
		const action = deferred();
		const failure = new Error("broken action");
		const onComplete = vi.fn();
		const onError = vi.fn();
		const { container } = await renderScreen({
			action: action.promise,
			onComplete,
			onError,
		});
		await act(async () => {
			action.reject(failure);
			await action.promise.catch(() => undefined);
			vi.advanceTimersByTime(defaultLoadingMinimumDurationMs);
			await Promise.resolve();
		});
		expect(progressValue(container)).toBe(94);
		expect(onComplete).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledWith(failure);
	});

	it("keeps the completed hold but skips interpolation for reduced motion", async () => {
		vi.mocked(window.matchMedia).mockReturnValue({
			matches: true,
		} as MediaQueryList);
		const onComplete = vi.fn();
		const { container } = await renderScreen({
			action: Promise.resolve(),
			minimumDurationMs: 0,
			onComplete,
		});
		await act(async () => {
			vi.advanceTimersByTime(0);
			await Promise.resolve();
		});
		expect(progressValue(container)).toBe(100);
		await act(async () => vi.advanceTimersByTime(349));
		expect(onComplete).not.toHaveBeenCalled();
		await act(async () => vi.advanceTimersByTime(1));
		expect(onComplete).toHaveBeenCalledOnce();
	});
});
