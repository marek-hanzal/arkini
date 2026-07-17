// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import type { GameOwner } from "~/bridge/game/GameOwner";
import { GameOwnerContext } from "~/bridge/game/GameOwnerContext";
import { GameMenu } from "~/ui/game-menu/GameMenu";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const fromPromiseFx = (run: () => Promise<void>) =>
	Effect.tryPromise({
		try: run,
		catch: (cause) => cause,
	});

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

const createGame = (flushSaveFx: Game["flushSaveFx"] = Effect.void): Game => ({
	arkpack: {
		packageId: "package:menu",
		contentHash: "content:menu",
		gameId: "game:menu",
		title: "Menu game",
		configVersion: "1.0",
		compressedSize: 0,
		source: "imported",
	},
	config: testArkpackConfig,
	saveKey: {
		packageId: "package:menu",
		contentHash: "b".repeat(64),
	},
	instanceKey: "game-instance:menu",
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx,
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const createOwner = ({
	game,
	releaseRouteGameFx = Effect.void,
	hardResetFx = Effect.void,
}: {
	readonly game: Game;
	readonly releaseRouteGameFx?: Effect.Effect<void, unknown>;
	readonly hardResetFx?: Effect.Effect<void, unknown>;
}): GameOwner => ({
	getSnapshot: () => ({
		type: "ready",
		game,
	}),
	selectPackageFx: () => Effect.void,
	releaseRouteGameFx: () => releaseRouteGameFx,
	shutdownFx: () => Effect.void,
	clearFailedSaveAndRetryFx: () => Effect.void,
	hardResetFx: () => hardResetFx,
	subscribe: () => () => undefined,
});

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

const renderMenu = async ({
	game = createGame(),
	owner = createOwner({
		game,
	}),
	initialPath = "/game/package:menu",
}: {
	readonly game?: Game;
	readonly owner?: GameOwner;
	readonly initialPath?: string;
} = {}) => {
	const container = document.createElement("div");
	document.body.append(container);
	const queryClient = new QueryClient();
	const App = () =>
		createElement(
			QueryClientProvider,
			{
				client: queryClient,
			},
			createElement(
				GameOwnerContext.Provider,
				{
					value: owner,
				},
				createElement(
					GameMenuProvider,
					null,
					createElement(
						"button",
						{
							type: "button",
							id: "game-surface",
						},
						"Game surface",
					),
					createElement(GameMenu, {
						game,
					}),
				),
			),
		);
	const rootRoute = createRootRoute({
		component: App,
	});
	const router = createRouter({
		routeTree: rootRoute,
		history: createMemoryHistory({
			initialEntries: [
				initialPath,
			],
		}),
	});
	await router.load();
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(RouterProvider, {
				router,
			}),
		);
	});
	return {
		container,
		router,
	};
};

const pressEscape = async () => {
	await act(async () => {
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				cancelable: true,
			}),
		);
	});
};

const buttonByText = (container: ParentNode, text: string) => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent === text,
	);
	if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected ${text}.`);
	return button;
};

describe("GameMenu", () => {
	it("toggles with Escape, traps focus and restores the game surface", async () => {
		const { container } = await renderMenu();
		const surface = container.querySelector<HTMLButtonElement>("#game-surface");
		if (surface === null) throw new Error("Expected the game surface control.");
		surface.focus();

		await pressEscape();

		const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
		expect(dialog).not.toBeNull();
		expect(container.querySelector('[data-ui="GameMenuBackdrop"]')).not.toBeNull();
		expect(document.activeElement?.textContent).toBe("Return to game");

		const destroy = buttonByText(dialog ?? container, "Destroy");
		destroy.focus();
		await act(async () => {
			destroy.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Tab",
					bubbles: true,
					cancelable: true,
				}),
			);
		});
		expect(document.activeElement?.textContent).toBe("Return to game");

		await pressEscape();
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(surface);
	});

	it("runs one save while disabling overlapping menu actions", async () => {
		const gate = deferred();
		const flush = vi.fn(() => gate.promise);
		const game = createGame(fromPromiseFx(flush));
		const { container } = await renderMenu({
			game,
			owner: createOwner({
				game,
			}),
		});
		await pressEscape();
		const save = buttonByText(container, "Save");

		await act(async () => save.click());
		save.click();
		expect(flush).toHaveBeenCalledOnce();
		expect(buttonByText(container, "Save and exit").disabled).toBe(true);

		await act(async () => {
			gate.resolve();
			await gate.promise;
			await vi.waitFor(() => expect(container.textContent).toContain("Saved."));
		});
	});

	it("navigates only after safe route release succeeds", async () => {
		const gate = deferred();
		const release = vi.fn(() => gate.promise);
		const game = createGame();
		const { container, router } = await renderMenu({
			game,
			owner: createOwner({
				game,
				releaseRouteGameFx: fromPromiseFx(release),
			}),
		});
		await pressEscape();

		await act(async () => buttonByText(container, "Save and exit").click());
		expect(router.state.location.pathname).toBe("/game/package:menu");

		await act(async () => {
			gate.resolve();
			await gate.promise;
			await vi.waitFor(() => expect(router.state.location.pathname).toBe("/"));
		});
	});

	it("keeps the menu and route after save-and-exit fails", async () => {
		const failure = new Error("disk full");
		const game = createGame();
		const { container, router } = await renderMenu({
			game,
			owner: createOwner({
				game,
				releaseRouteGameFx: Effect.fail(failure),
			}),
		});
		await pressEscape();

		await act(async () => buttonByText(container, "Save and exit").click());
		await vi.waitFor(() =>
			expect(container.textContent).toContain("Save and exit failed: disk full"),
		);
		expect(router.state.location.pathname).toBe("/game/package:menu");
		expect(container.querySelector('[role="dialog"]')).not.toBeNull();
	});

	it("requires confirmation and invokes the canonical hard reset once", async () => {
		const reset = vi.fn();
		const game = createGame();
		const { container } = await renderMenu({
			game,
			owner: createOwner({
				game,
				hardResetFx: Effect.sync(reset),
			}),
		});
		await pressEscape();

		await act(async () => buttonByText(container, "Destroy").click());
		expect(reset).not.toHaveBeenCalled();
		expect(container.textContent).toContain("Current progress will be permanently deleted");

		await act(async () => buttonByText(container, "Destroy permanently").click());
		await vi.waitFor(() => expect(reset).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull());
	});

	it("keeps one Escape listener while React re-renders the provider", async () => {
		const addEventListener = vi.spyOn(window, "addEventListener");
		await renderMenu();
		expect(addEventListener.mock.calls.filter(([event]) => event === "keydown")).toHaveLength(
			1,
		);
	});
});
