import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, vi } from "vitest";

import { routeTree } from "~/_route";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import type { ArkiniElectronApi } from "../../../electron/contract/ArkiniElectronApi";
import type { EditorBoardGameResource } from "~/board-scenario/service/EditorBoardGameResource";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/atom/EditorBoardGameResourceOwnerAtom";
import type { Game } from "~/installed-game/type/Game";
import { createGameEngineResourceFx } from "~/playable-game/fx/createGameEngineResourceFx";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";
import { testArkpackConfig } from "~test/arkpack-support/fx/createTestArkpack";
import { createTestRendererRuntime } from "~test/support/createTestRendererRuntime";
import { makeTestGameTransitionFieldsFx } from "~test/support/game/makeTestGameTransitionFieldsFx";
import { testGameRead } from "~test/support/game/testGameRead";

export const packageId = "package-route-load";

const roots: Array<ReturnType<typeof createRoot>> = [];
const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];
export const createGameFxMock = vi.fn();
export const clearSaveMock = vi.fn((_key: GameSaveStorage.Key) => Promise.resolve());

export const createGame = ({
	createdPackageId = packageId,
	disposeWithoutSaveFx = Effect.void,
}: {
	readonly createdPackageId?: string;
	readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
} = {}): Game => ({
	arkpack: {
		packageId: createdPackageId,
		contentHash: "content-route-load",
		title: testArkpackConfig.meta.title,
		version: "1.0",
		arkini: ArkiniAppVersion,
		provenance: {
			type: "community",
		} as const,
		source: "user",
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
	},
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

export const createHarness = (initialPath: string) => {
	const { rendererRuntime } = createTestRendererRuntime({
		clearSaveFx: (key) =>
			Effect.tryPromise({
				try: () => clearSaveMock(key),
				catch: (cause) => cause,
			}),
		createResourceFx: (selectedPackageId) =>
			(createGameFxMock(selectedPackageId) as Effect.Effect<Game, unknown>).pipe(
				Effect.flatMap((game) => createGameEngineResourceFx(game)),
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

export const installEditorBoardGameOwner = (
	rendererRuntime: ReturnType<typeof createTestRendererRuntime>["rendererRuntime"],
	releaseCurrentFx: EditorBoardGameResource["releaseCurrentFx"],
) => {
	const state = Effect.runSync(
		SubscriptionRef.make<EditorBoardGameResource.State>({
			type: "idle",
		}),
	);
	const owner = {
		state,
		syncFx: () => Effect.void,
		publishFx: () => Effect.void,
		replaceFx: () => Effect.void,
		releaseCurrentFx,
		shutdownFx: Effect.void,
	} satisfies EditorBoardGameResource;
	rendererRuntime.runSync(Atom.set(EditorBoardGameResourceOwnerAtom, owner));
};

export const loadRoute = async (router: ReturnType<typeof createHarness>["router"]) => {
	const loading = router.load();
	await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalled());
	await vi.advanceTimersByTimeAsync(2_500);
	await loading;
};

export const renderRouter = async (router: ReturnType<typeof createHarness>["router"]) => {
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

export const clickControl = async (container: HTMLElement, label: string) => {
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

export const waitForEffectSettlement = async (assertion: () => void) => {
	const usesFakeTimers = vi.isFakeTimers();
	if (usesFakeTimers) vi.useRealTimers();
	try {
		await vi.waitFor(assertion);
	} finally {
		if (usesFakeTimers) vi.useFakeTimers();
	}
};

export const setUpGameLoadRouteTest = () => {
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
};

export const tearDownGameLoadRouteTest = async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	for (const runtime of runtimes.splice(0)) await runtime.dispose();
	vi.restoreAllMocks();
	document.body.replaceChildren();
};
