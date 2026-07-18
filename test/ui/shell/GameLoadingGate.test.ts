// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameLoadingGate } from "~/ui/shell/GameLoadingGate";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const deferred = () => {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((complete) => {
		resolve = complete;
	});
	return {
		promise,
		resolve,
	};
};

const gateElement = ({
	failure = null,
	ready = true,
}: {
	readonly failure?: ReactNode | null;
	readonly ready?: boolean;
}) =>
	createElement(GameLoadingGate, {
		children: createElement("div", {
			"data-ui": "LoadedGame",
		}),
		failure,
		ready,
	});

const renderGate = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(gateElement({}));
	});
	return {
		container,
		root,
	};
};

const installViewTransition = () => {
	const startViewTransition = vi.fn((update: () => void) => {
		update();
		return {
			finished: Promise.resolve(),
			ready: Promise.resolve(),
			skipTransition: vi.fn(),
			updateCallbackDone: Promise.resolve(),
		} as unknown as ViewTransition;
	});
	Object.defineProperty(document, "startViewTransition", {
		configurable: true,
		value: startViewTransition,
	});
	return startViewTransition;
};

beforeEach(() => {
	vi.useFakeTimers();
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn(() => ({
			matches: false,
		})),
	});
	Object.defineProperty(document, "getAnimations", {
		configurable: true,
		value: vi.fn(() => []),
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
	Reflect.deleteProperty(document, "startViewTransition");
});

describe("GameLoadingGate", () => {
	it("reveals the loaded game inside one local native View Transition", async () => {
		const startViewTransition = installViewTransition();
		const { container } = await renderGate();

		expect(container.querySelector('[data-ui="GameLoadingScreen"]')).not.toBeNull();
		await act(async () => vi.advanceTimersByTime(330));

		expect(startViewTransition).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-ui="GameLoadingScreen"]')).toBeNull();
		expect(container.querySelector('[data-ui="LoadedGame"]')).not.toBeNull();
	});

	it("waits for an active route View Transition before revealing the board", async () => {
		const active = deferred();
		const animation = {
			effect: {
				pseudoElement: "::view-transition-new(arkini-route-scene)",
			},
			finished: active.promise,
		} as unknown as Animation;
		vi.mocked(document.getAnimations).mockReturnValue([
			animation,
		]);
		const startViewTransition = installViewTransition();
		const { container } = await renderGate();

		await act(async () => vi.advanceTimersByTime(330));
		expect(startViewTransition).not.toHaveBeenCalled();
		expect(container.querySelector('[data-ui="GameLoadingScreen"]')).not.toBeNull();

		await act(async () => {
			active.resolve();
			await active.promise;
			await Promise.resolve();
		});
		expect(startViewTransition).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-ui="LoadedGame"]')).not.toBeNull();
	});

	it("falls back to a normal reveal when native View Transitions are unavailable", async () => {
		Reflect.deleteProperty(document, "startViewTransition");
		const { container } = await renderGate();

		await act(async () => vi.advanceTimersByTime(330));

		expect(container.querySelector('[data-ui="GameLoadingScreen"]')).toBeNull();
		expect(container.querySelector('[data-ui="LoadedGame"]')).not.toBeNull();
	});

	it("cancels a stale reveal on failure and allows a later retry", async () => {
		const active = deferred();
		vi.mocked(document.getAnimations).mockReturnValue([
			{
				effect: {
					pseudoElement: "::view-transition-new(arkini-route-scene)",
				},
				finished: active.promise,
			} as unknown as Animation,
		]);
		const startViewTransition = installViewTransition();
		const { container, root } = await renderGate();
		await act(async () => vi.advanceTimersByTime(330));

		await act(async () => {
			root.render(
				gateElement({
					failure: createElement("div", {
						"data-ui": "LoadFailure",
					}),
					ready: false,
				}),
			);
		});
		await act(async () => {
			active.resolve();
			await active.promise;
			await Promise.resolve();
		});

		expect(startViewTransition).not.toHaveBeenCalled();
		expect(container.querySelector('[data-ui="LoadFailure"]')).not.toBeNull();

		vi.mocked(document.getAnimations).mockReturnValue([]);
		await act(async () => {
			root.render(gateElement({}));
		});
		await act(async () => vi.advanceTimersByTime(330));

		expect(startViewTransition).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-ui="LoadedGame"]')).not.toBeNull();
	});

	it("does not reveal after unmount while waiting for an active transition", async () => {
		const active = deferred();
		vi.mocked(document.getAnimations).mockReturnValue([
			{
				effect: {
					pseudoElement: "::view-transition-old(arkini-route-scene)",
				},
				finished: active.promise,
			} as unknown as Animation,
		]);
		const startViewTransition = installViewTransition();
		const { root } = await renderGate();
		await act(async () => vi.advanceTimersByTime(330));
		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);

		await act(async () => {
			active.resolve();
			await active.promise;
			await Promise.resolve();
		});
		expect(startViewTransition).not.toHaveBeenCalled();
	});
});
