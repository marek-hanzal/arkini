// @vitest-environment jsdom

import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameSaveBootstrapError } from "~/renderer/game/GameSaveBootstrapError";
import { GameEngineResourceFx } from "~/renderer/game/resource/GameEngineResourceFx";
import {
	clearSaveMock,
	clickControl,
	createGame,
	createGameFxMock,
	createHarness,
	loadRoute,
	packageId,
	renderRouter,
	setUpGameLoadRouteTest,
	tearDownGameLoadRouteTest,
} from "~test/router/GameLoadRouteLifecycle.test/fixture";

beforeEach(setUpGameLoadRouteTest);
afterEach(tearDownGameLoadRouteTest);

describe("game load failure recovery", () => {
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
		expect(
			rendererRuntime.runSync(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.currentFx)),
			),
		).toBeNull();
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
		expect(
			rendererRuntime.runSync(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.currentFx)),
			),
		).toBeNull();
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
		expect(
			rendererRuntime.runSync(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.currentFx)),
			)?.game.arkpack,
		).toBe(game.arkpack);
		expect(createGameFxMock).toHaveBeenCalledTimes(createCallsBeforeCleanup + 1);
	});

	it("keeps exact cleanup failure visible and retries cleanup rather than Game loading", async () => {
		const saveKey = {
			packageId,
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
		expect(
			rendererRuntime.runSync(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.currentFx)),
			),
		).toBeNull();
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
