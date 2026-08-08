// @vitest-environment jsdom

import { Deferred, Effect, Exit, Scope } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProjectRepositoryService } from "~/bridge/editor/EditorProjectRepository";
import { acquireGameEngineLeaseFx } from "~/bridge/game/acquireGameEngineLeaseFx";
import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { installRendererControlledCloseFx } from "~/installRendererControlledCloseFx";
import type { ArkiniRouter } from "~/createArkiniRouterFx";
import { actionLoadingCompletionHoldMs } from "~/ui/loading/actionLoadingCompletionHoldMs";
import {
	adoptTestGameEngineResourceFx,
	createTestRendererRuntime,
} from "~test/support/createTestRendererRuntime";

type CloseListener = () => Promise<void>;

const createResource = (packageId: string): GameEngineResource => ({
	game: {
		arkpack: {
			packageId,
		},
		disposeFx: Effect.void,
		disposeWithoutSaveFx: Effect.void,
	} as unknown as GameEngineResource["game"],
	assertUsable: () => undefined,
	getCriticalFailure: () => null,
	markCriticalFailure: (operation, cause) =>
		cause instanceof CriticalGameLifecycleError
			? cause
			: new CriticalGameLifecycleError({
					operation,
					cause,
				}),
	subscribeCriticalFailure: () => () => undefined,
});

const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];

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

afterEach(async () => {
	vi.useRealTimers();
	for (const runtime of runtimes.splice(0)) await runtime.dispose();
	vi.restoreAllMocks();
});

describe("installRendererControlledClose", () => {
	it("replace-navigates an active Game and waits for its painted completion hold", async () => {
		const resource = createResource("package:close");
		const { rendererRuntime } = createTestRendererRuntime({
			createResourceFx: () => Effect.succeed(resource),
		});
		runtimes.push(rendererRuntime);
		vi.useRealTimers();
		await rendererRuntime.runPromise(adoptTestGameEngineResourceFx("package:close"));
		vi.useFakeTimers();
		const lifecycle = createLifecycle();
		const router = createRouter();
		const frames = frameHarness();
		const remove = rendererRuntime.runSync(
			installRendererControlledCloseFx({
				lifecycle: lifecycle.lifecycle,
				rendererRuntime,
				router: router.router,
			}),
		);

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
		const { rendererRuntime } = createTestRendererRuntime({
			createResourceFx: () => Effect.never,
		});
		runtimes.push(rendererRuntime);
		const lifecycle = createLifecycle();
		const router = createRouter();
		const frames = frameHarness();
		const remove = rendererRuntime.runSync(
			installRendererControlledCloseFx({
				lifecycle: lifecycle.lifecycle,
				rendererRuntime,
				router: router.router,
			}),
		);

		await lifecycle.readBeforeClose()();
		await lifecycle.readBeforeCloseReady()();

		expect(router.navigate).not.toHaveBeenCalled();
		expect(frames.requestAnimationFrame).not.toHaveBeenCalled();
		remove();
	});

	it("waits for admitted editor repository writes before native close", async () => {
		const idle = Effect.runSync(Deferred.make<void>());
		const repository: EditorProjectRepositoryService = {
			awaitIdleFx: Deferred.await(idle),
			createProjectFx: () => Effect.die("Unexpected create."),
			listProjectsFx: Effect.die("Unexpected list."),
			readProjectFx: () => Effect.die("Unexpected read."),
			replaceConfigFx: () => Effect.die("Unexpected config save."),
			replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
			upsertItemFx: () => Effect.die("Unexpected item save."),
			upsertResourcesFx: () => Effect.die("Unexpected resource save."),
		};
		const { rendererRuntime } = createTestRendererRuntime({
			createResourceFx: () => Effect.never,
			editorProjectRepository: repository,
		});
		runtimes.push(rendererRuntime);
		const lifecycle = createLifecycle();
		const router = createRouter();
		const remove = rendererRuntime.runSync(
			installRendererControlledCloseFx({
				lifecycle: lifecycle.lifecycle,
				rendererRuntime,
				router: router.router,
			}),
		);

		let closed = false;
		const close = lifecycle
			.readBeforeClose()()
			.then(() => {
				closed = true;
			});
		await Promise.resolve();
		expect(closed).toBe(false);
		Effect.runSync(Deferred.succeed(idle, undefined));
		await close;
		expect(closed).toBe(true);
		expect(router.navigate).not.toHaveBeenCalled();
		remove();
	});

	it("joins pending singleton creation before selecting the exact exit route", async () => {
		vi.useRealTimers();
		const resource = createResource("package:pending");
		const creation = Effect.runSync(Deferred.make<GameEngineResource>());
		const createResourceFx = vi.fn(() => Deferred.await(creation));
		const { rendererRuntime } = createTestRendererRuntime({
			createResourceFx,
		});
		runtimes.push(rendererRuntime);
		const scope = Effect.runSync(Scope.make());
		const acquisition = rendererRuntime.runPromise(
			acquireGameEngineLeaseFx({
				packageId: "package:pending",
			}).pipe(Effect.provideService(Scope.Scope, scope)),
		);
		const lifecycle = createLifecycle();
		const router = createRouter();
		const remove = rendererRuntime.runSync(
			installRendererControlledCloseFx({
				lifecycle: lifecycle.lifecycle,
				rendererRuntime,
				router: router.router,
			}),
		);

		const beforeClose = lifecycle.readBeforeClose()();
		await vi.waitFor(() => expect(createResourceFx).toHaveBeenCalledOnce());
		expect(router.navigate).not.toHaveBeenCalled();
		Effect.runSync(Deferred.succeed(creation, resource));
		await acquisition;
		await beforeClose;

		expect(router.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/action/exit",
			params: {
				packageId: "package:pending",
			},
			replace: true,
		});
		await Effect.runPromise(Scope.close(scope, Exit.void));
		remove();
	});
});
