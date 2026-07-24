// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { installRendererControlledClose } from "~/installRendererControlledClose";
import type { ArkiniRouter } from "~/router";
import { actionLoadingCompletionHoldMs } from "~/ui/loading/waitForActionLoadingCompletionFrame";

type CloseListener = () => Promise<void>;

const createResource = (packageId: string) =>
	({
		game: {
			arkpack: {
				packageId,
			},
		},
	}) as GameEngineResource;

const createLifecycle = () => {
	let beforeClose: CloseListener | undefined;
	let beforeCloseReady: CloseListener | undefined;
	const removeBeforeClose = vi.fn();
	const removeBeforeCloseReady = vi.fn();
	return {
		lifecycle: {
			onBeforeClose: (listener: CloseListener) => {
				beforeClose = listener;
				return removeBeforeClose;
			},
			onBeforeCloseReady: (listener: CloseListener) => {
				beforeCloseReady = listener;
				return removeBeforeCloseReady;
			},
		},
		readBeforeClose: () => {
			if (beforeClose === undefined) throw new Error("Missing before-close listener.");
			return beforeClose;
		},
		readBeforeCloseReady: () => {
			if (beforeCloseReady === undefined) {
				throw new Error("Missing before-close-ready listener.");
			}
			return beforeCloseReady;
		},
		removeBeforeClose,
		removeBeforeCloseReady,
	};
};

const createRouter = () => {
	const navigate = vi.fn(() => Promise.resolve());
	return {
		navigate,
		router: {
			navigate: navigate as ArkiniRouter["navigate"],
		},
	};
};

const frameHarness = () => {
	const callbacks: FrameRequestCallback[] = [];
	const requestAnimationFrame = vi
		.spyOn(window, "requestAnimationFrame")
		.mockImplementation((callback) => {
			callbacks.push(callback);
			return callbacks.length;
		});
	return {
		callbacks,
		requestAnimationFrame,
	};
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("installRendererControlledClose", () => {
	it("replace-navigates an active Game and waits for its painted completion hold", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(gameEngineQueryKey, createResource("package:close"));
		const lifecycle = createLifecycle();
		const router = createRouter();
		const frames = frameHarness();
		const remove = installRendererControlledClose({
			lifecycle: lifecycle.lifecycle,
			queryClient,
			router: router.router,
		});

		await lifecycle.readBeforeClose()();
		expect(router.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/action/exit",
			params: {
				packageId: "package:close",
			},
			replace: true,
		});

		let ready = false;
		const presentation = lifecycle
			.readBeforeCloseReady()()
			.then(() => {
				ready = true;
			});
		expect(frames.callbacks).toHaveLength(1);
		frames.callbacks.shift()?.(0);
		await Promise.resolve();
		expect(ready).toBe(false);
		expect(frames.callbacks).toHaveLength(1);
		frames.callbacks.shift()?.(16);
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(actionLoadingCompletionHoldMs - 1);
		expect(ready).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		await presentation;
		expect(ready).toBe(true);

		remove();
		expect(lifecycle.removeBeforeClose).toHaveBeenCalledOnce();
		expect(lifecycle.removeBeforeCloseReady).toHaveBeenCalledOnce();
	});

	it("closes directly when no current or pending Game exists", async () => {
		const lifecycle = createLifecycle();
		const router = createRouter();
		const frames = frameHarness();
		installRendererControlledClose({
			lifecycle: lifecycle.lifecycle,
			queryClient: new QueryClient(),
			router: router.router,
		});

		await lifecycle.readBeforeClose()();
		await lifecycle.readBeforeCloseReady()();

		expect(router.navigate).not.toHaveBeenCalled();
		expect(frames.requestAnimationFrame).not.toHaveBeenCalled();
	});

	it("joins pending singleton creation before selecting the exact exit route", async () => {
		const queryClient = new QueryClient();
		const resource = createResource("package:pending");
		let resolveResource!: (value: GameEngineResource) => void;
		const creation = queryClient.fetchQuery({
			queryKey: gameEngineQueryKey,
			queryFn: () =>
				new Promise<GameEngineResource>((resolve) => {
					resolveResource = resolve;
				}),
		});
		const lifecycle = createLifecycle();
		const router = createRouter();
		installRendererControlledClose({
			lifecycle: lifecycle.lifecycle,
			queryClient,
			router: router.router,
		});

		const beforeClose = lifecycle.readBeforeClose()();
		await Promise.resolve();
		expect(router.navigate).not.toHaveBeenCalled();
		resolveResource(resource);
		await creation;
		await beforeClose;

		expect(router.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/action/exit",
			params: {
				packageId: "package:pending",
			},
			replace: true,
		});
	});
});
