// @vitest-environment jsdom

import { Deferred, Effect, Exit, Scope } from "effect";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as EditorRoute } from "~/@routes/editor";
import { acquireGameEngineLeaseFx } from "~/bridge/game/acquireGameEngineLeaseFx";
import { adoptGameEngineLeaseFx } from "~/bridge/game/adoptGameEngineLeaseFx";
import { readCurrentGameEngineResourceFx } from "~/bridge/game/readCurrentGameEngineResourceFx";
import {
	createGame,
	createGameFxMock,
	createHarness,
	packageId,
	setUpGameLoadRouteTest,
	tearDownGameLoadRouteTest,
} from "~test/router/GameLoadRouteLifecycle.test/fixture";

beforeEach(setUpGameLoadRouteTest);
afterEach(tearDownGameLoadRouteTest);

const installEditorApis = () => {
	const status = vi.fn(() =>
		Promise.resolve({
			type: "ready" as const,
		}),
	);
	const activateMcp = vi.fn(() =>
		Promise.resolve({
			type: "ready" as const,
			port: 32_310,
		}),
	);
	Object.assign(window.arkini, {
		editor: {
			status,
		},
		editorMcp: {
			activate: activateMcp,
		},
	});
	return {
		activateMcp,
		status,
	};
};

describe("Editor entry Game handoff", () => {
	it("cancels a stale Editor continuation without cancelling a newer Play acquisition", async () => {
		const disposalStarted = Effect.runSync(Deferred.make<void>());
		const disposalGate = Effect.runSync(Deferred.make<void>());
		const nextPackageId = "package-after-stale-editor";
		const firstGame = createGame({
			disposeWithoutSaveFx: Deferred.succeed(disposalStarted, undefined).pipe(
				Effect.andThen(Deferred.await(disposalGate)),
			),
		});
		const nextGame = createGame({
			createdPackageId: nextPackageId,
		});
		createGameFxMock
			.mockReturnValueOnce(Effect.succeed(firstGame))
			.mockReturnValueOnce(Effect.succeed(nextGame));
		const editorApis = installEditorApis();
		const { rendererRuntime, router } = createHarness(`/action/load-game/${packageId}`);

		try {
			const initialLoad = router.load();
			await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());
			expect(rendererRuntime.runSync(readCurrentGameEngineResourceFx())).toBeNull();
			let staleEditorNavigation: ReturnType<typeof router.navigate>;
			await act(async () => {
				staleEditorNavigation = router.navigate({
					to: "/editor",
					replace: true,
				});
				await Promise.resolve();
				await vi.advanceTimersByTimeAsync(2_500);
			});
			await Effect.runPromise(Deferred.await(disposalStarted));

			const freshPlayNavigation = router.navigate({
				to: "/action/load-game/$packageId",
				params: {
					packageId: nextPackageId,
				},
				replace: true,
			});
			await Promise.resolve();
			Effect.runSync(Deferred.succeed(disposalGate, undefined));
			await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledTimes(2));
			await vi.advanceTimersByTimeAsync(2_500);
			await freshPlayNavigation;
			await Promise.allSettled([
				initialLoad,
				staleEditorNavigation!,
			]);

			expect(editorApis.status).not.toHaveBeenCalled();
			expect(editorApis.activateMcp).not.toHaveBeenCalled();
			expect(router.state.location.pathname).toBe(`/game/${nextPackageId}/board`);
			expect(
				rendererRuntime.runSync(readCurrentGameEngineResourceFx())?.game.arkpack.packageId,
			).toBe(nextPackageId);
		} finally {
			Effect.runSync(Deferred.succeed(disposalGate, undefined));
		}
	});

	it("keeps provisional Game ownership untouched during Editor preload", async () => {
		const discard = vi.fn();
		const game = createGame({
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		createGameFxMock.mockReturnValue(Effect.succeed(game));
		const editorApis = installEditorApis();
		const { rendererRuntime } = createHarness("/main-menu");
		const scope = Effect.runSync(Scope.make());

		try {
			const leasePromise = rendererRuntime.runPromise(
				acquireGameEngineLeaseFx({
					packageId,
				}).pipe(Effect.provideService(Scope.Scope, scope)),
			);
			await vi.waitFor(() => expect(createGameFxMock).toHaveBeenCalledOnce());
			const lease = await leasePromise;

			const preloadEditor = EditorRoute.options.beforeLoad;
			if (preloadEditor === undefined) throw new Error("Editor beforeLoad missing.");
			await preloadEditor({
				preload: true,
			} as Parameters<typeof preloadEditor>[0]);

			expect(discard).not.toHaveBeenCalled();
			expect(editorApis.status).not.toHaveBeenCalled();
			expect(editorApis.activateMcp).not.toHaveBeenCalled();
			await expect(rendererRuntime.runPromise(adoptGameEngineLeaseFx(lease))).resolves.toBe(
				lease.resource,
			);
		} finally {
			await Effect.runPromise(Scope.close(scope, Exit.void));
		}
	});
});
