// @vitest-environment jsdom

import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "~/_route";
import type { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import type { Game } from "~/bridge/game/Game";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { makeTestGameTransitionFieldsFx } from "~test/support/game/makeTestGameTransitionFieldsFx";
import { createTestRendererRuntime } from "~test/support/createTestRendererRuntime";
import { testGameRead } from "~test/support/game/testGameRead";

const packageId = "package-route-load";

const roots: Array<ReturnType<typeof createRoot>> = [];
const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];
const createGameFxMock = vi.fn();
const clearSaveMock = vi.fn((_key: GameSaveStorage.Key) => Promise.resolve());

const createGame = ({
	createdPackageId = packageId,
	disposeWithoutSaveFx = Effect.void,
}: {
	readonly createdPackageId?: string;
	readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
} = {}): Game => ({
	arkpack: {
		packageId: createdPackageId,
		contentHash: "content-route-load",
		gameId: testArkpackConfig.meta.id,
		title: testArkpackConfig.meta.title,
		configVersion: testArkpackConfig.version,
		compressedSize: 0,
		trust: {
			type: "external",
			reason: "unsigned",
		} as const,
		source: "imported",
	},
	config: testArkpackConfig,
	disposeFx: Effect.void,
	disposeWithoutSaveFx,
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	...Effect.runSync(makeTestGameTransitionFieldsFx({} as ReturnType<Game["getSnapshot"]>)),
	read: testGameRead,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	saveKey: {
		packageId,
		contentHash: "0".repeat(64),
	},
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const createHarness = (initialPath: string) => {
	const { rendererRuntime } = createTestRendererRuntime({
		clearSaveFx: (key) =>
			Effect.tryPromise({
				try: () => clearSaveMock(key),
				catch: (cause) => cause,
			}),
		createResourceFx: (selectedPackageId) =>
			(createGameFxMock(selectedPackageId) as Effect.Effect<Game, unknown>).pipe(
				Effect.flatMap(createGameEngineResourceFx),
			),
	});
	runtimes.push(rendererRuntime);
	const router = createRouter({
		routeTree,
		isServer: false,
		context: {
			rendererRuntime,
		},
		history: createMemoryHistory({
			initialEntries: [
				initialPath,
			],
		}),
	});
	return {
		rendererRuntime,
		router,
	};
};

const loadRoute = async (router: ReturnType<typeof createHarness>["router"]) => {
	const loading = router.load();
	await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalled());
	await vi.advanceTimersByTimeAsync(2_500);
	await loading;
};

const renderRouter = async (router: ReturnType<typeof createHarness>["router"]) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(RouterProvider, {
				router,
			}),
		);
	});
	return container;
};
const clickControl = async (container: HTMLElement, label: string) => {
	const control = [
		...container.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>("a, button"),
	].find((candidate) => candidate.textContent === label);
	if (control === undefined) throw new Error(`Missing control: ${label}`);
	await act(async () => {
		control.click();
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(2_500);
		await Promise.resolve();
	});
};

const waitForEffectSettlement = async (assertion: () => void) => {
	const usesFakeTimers = vi.isFakeTimers();
	if (usesFakeTimers) vi.useRealTimers();
	try {
		await vi.waitFor(assertion);
	} finally {
		if (usesFakeTimers) vi.useFakeTimers();
	}
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, "error").mockImplementation(() => undefined);
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
	createGameFxMock.mockReset();
	clearSaveMock.mockReset();
	clearSaveMock.mockResolvedValue(undefined);
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				forceClose: vi.fn(),
			},
			save: {
				clear: clearSaveMock,
				read: vi.fn(() => Promise.resolve(null)),
				write: vi.fn(() => Promise.resolve()),
			},
		} as unknown as ArkiniElectronApi.Api,
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	for (const runtime of runtimes.splice(0)) await runtime.dispose();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("game load action lifecycle", () => {
	it("creates one stable Game before redirecting the explicit load action to Board", async () => {
		const game = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);

		await loadRoute(router);

		expect(createGameFxMock).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.game.arkpack).toBe(
			game.arkpack,
		);
	});

	it("repairs a direct Board entry through the same explicit load action", async () => {
		const game = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const { rendererRuntime, router } = createHarness(`/game/${packageId}/board`);

		await loadRoute(router);

		expect(createGameFxMock).toHaveBeenCalledOnce();
		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.game.arkpack).toBe(
			game.arkpack,
		);
	});

	it("cancels an unfinished route-owned creation when navigation leaves the load action", async () => {
		const interrupted = vi.fn();
		createGameFxMock.mockReturnValue(
			Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(interrupted))),
		);
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		const loading = router.load();
		await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());

		await act(async () => {
			const navigation = router.navigate({
				to: "/main-menu",
				replace: true,
			});
			await Promise.resolve();
			await vi.advanceTimersByTimeAsync(2_500);
			await navigation;
		});
		await loading;

		expect(router.state.location.pathname).toBe("/main-menu");
		await waitForEffectSettlement(() => expect(interrupted).toHaveBeenCalledOnce());
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
	});

	it("keeps a completed Game provisional and discards it when the load action leaves during its hold", async () => {
		const discard = vi.fn();
		createGameFxMock.mockReturnValue(
			Effect.succeed(
				createGame({
					disposeWithoutSaveFx: Effect.sync(discard),
				}),
			),
		);
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		const loading = router.load();
		await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();

		await act(async () => {
			const navigation = router.navigate({
				to: "/main-menu",
				replace: true,
			});
			await Promise.resolve();
			await vi.advanceTimersByTimeAsync(2_500);
			await navigation;
		});
		await loading;

		expect(router.state.location.pathname).toBe("/main-menu");
		await waitForEffectSettlement(() => expect(discard).toHaveBeenCalledOnce());
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
	});

	it("replaces a pending different-package creation without joining or poisoning either resource", async () => {
		const nextPackageId = "package-route-load-next";
		createGameFxMock.mockReturnValueOnce(Effect.never).mockReturnValueOnce(
			Effect.succeed(
				createGame({
					createdPackageId: nextPackageId,
				}),
			),
		);
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);
		const firstLoading = router.load();
		await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());

		await act(async () => {
			const navigation = router.navigate({
				to: "/action/load-game/$packageId",
				params: {
					packageId: nextPackageId,
				},
				replace: true,
			});
			await Promise.resolve();
			await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledTimes(2));
			await vi.advanceTimersByTimeAsync(2_500);
			await navigation;
		});
		await firstLoading;

		expect(createGameFxMock).toHaveBeenCalledTimes(2);
		expect(router.state.location.pathname).toBe(`/game/${nextPackageId}/board`);
		expect(
			rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.game.arkpack.packageId,
		).toBe(nextPackageId);
	});

	it("discards an ordinary failed bootstrap and exits without deleting a save", async () => {
		createGameFxMock.mockReturnValue(Effect.fail(new Error("bootstrap failed")));
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);

		await loadRoute(router);
		const container = await renderRouter(router);

		expect(container.querySelector('[data-ui="ActionErrorPage"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="RootFatalErrorPage"]')).toBeNull();
		expect(container.textContent).toContain("Exit to Main Menu");
		expect(container.textContent).not.toContain("Clean & Exit");
		expect(
			[
				...container.querySelectorAll("button, a"),
			].some((control) => control.textContent === "Retry"),
		).toBe(false);

		await clickControl(container, "Exit to Main Menu");

		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
		expect(clearSaveMock).not.toHaveBeenCalled();
		await act(async () => {
			router.history.back();
			await Promise.resolve();
		});
		expect(router.state.location.pathname).toBe("/main-menu");
	});

	it("cleans only the verified failed save, exits, and permits a later fresh Play", async () => {
		const saveKey = {
			packageId,
			contentHash: "a".repeat(64),
		};
		createGameFxMock.mockReturnValue(
			Effect.fail(
				new GameSaveBootstrapError({
					cause: new Error("invalid save"),
					saveKey,
				}),
			),
		);
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);

		await loadRoute(router);
		const container = await renderRouter(router);

		expect(container.textContent).toContain("Saved game could not be restored");
		expect(container.textContent).toContain("Clean & Exit");
		expect(container.textContent).not.toContain("Exit to Main Menu");
		expect(
			[
				...container.querySelectorAll("button, a"),
			].some((control) => control.textContent === "Retry"),
		).toBe(false);

		const createCallsBeforeCleanup = createGameFxMock.mock.calls.length;
		await clickControl(container, "Clean & Exit");

		await vi.waitFor(() => expect(clearSaveMock).toHaveBeenCalledOnce());
		expect(clearSaveMock).toHaveBeenCalledWith(saveKey);
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
		await vi.waitFor(() => expect(router.state.location.pathname).toBe("/main-menu"));
		expect(createGameFxMock).toHaveBeenCalledTimes(createCallsBeforeCleanup);
		await act(async () => {
			router.history.back();
			await Promise.resolve();
		});
		expect(router.state.location.pathname).toBe("/main-menu");

		const game = createGame();
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		await act(async () => {
			const navigation = router.navigate({
				to: "/action/load-game/$packageId",
				params: {
					packageId,
				},
			});
			await vi.waitFor(() =>
				expect(createGameFxMock).toHaveBeenCalledTimes(createCallsBeforeCleanup + 1),
			);
			await vi.advanceTimersByTimeAsync(2_500);
			await navigation;
		});

		expect(router.state.location.pathname).toBe(`/game/${packageId}/board`);
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.game.arkpack).toBe(
			game.arkpack,
		);
		expect(createGameFxMock).toHaveBeenCalledTimes(createCallsBeforeCleanup + 1);
	});

	it("keeps exact cleanup failure visible and retries cleanup rather than Game loading", async () => {
		const saveKey = {
			packageId,
			contentHash: "b".repeat(64),
		};
		createGameFxMock.mockReturnValue(
			Effect.fail(
				new GameSaveBootstrapError({
					cause: new Error("invalid save"),
					saveKey,
				}),
			),
		);
		clearSaveMock.mockRejectedValueOnce(new Error("disk refused cleanup"));
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);

		await loadRoute(router);
		const container = await renderRouter(router);
		const createCallsBeforeCleanup = createGameFxMock.mock.calls.length;
		await clickControl(container, "Clean & Exit");

		await vi.waitFor(() => {
			expect(router.state.location.pathname).toBe("/action/recover-game-save");
			expect(container.textContent).toContain("Save recovery failed");
			expect(container.textContent).toContain("Retry cleanup");
		});
		expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
		expect(createGameFxMock).toHaveBeenCalledTimes(createCallsBeforeCleanup);
	});

	it("bubbles a package identity violation from the load error page to the root fatal boundary", async () => {
		const discard = vi.fn();
		createGameFxMock.mockReturnValue(
			Effect.succeed(
				createGame({
					createdPackageId: "package-wrong",
					disposeWithoutSaveFx: Effect.sync(discard),
				}),
			),
		);
		const { router } = createHarness(`/action/load-game/${packageId}`);

		await loadRoute(router);
		const container = await renderRouter(router);

		expect(discard).toHaveBeenCalled();
		expect(container.querySelector('[data-ui="RootFatalErrorPage"]')).not.toBeNull();
		expect(container.querySelector('[data-ui="ActionErrorPage"]')).toBeNull();
	});
});
