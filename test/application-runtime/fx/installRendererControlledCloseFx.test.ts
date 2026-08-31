// @vitest-environment jsdom

import { Deferred, Effect, Exit, Scope } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { CriticalGameLifecycleError } from "~/playable-game/error/CriticalGameLifecycleError";
import type { InstalledGameEngineResource } from "~/installed-game/type/Game";
import { GameEngineResourceFx } from "~/installed-game/service/GameEngineResourceFx";
import { installRendererControlledCloseFx } from "~/application-runtime/fx/installRendererControlledCloseFx";
import type { ArkiniRouter } from "~/createArkiniRouterFx";
import {
	adoptTestGameEngineResourceFx,
	createTestRendererRuntime,
} from "~test/support/createTestRendererRuntime";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

type CloseListener = () => Promise<void>;

const createResource = (packageId: string): InstalledGameEngineResource => ({
	game: {
		arkpack: {
			packageId,
		},
		disposeFx: Effect.void,
		disposeWithoutSaveFx: Effect.void,
	} as unknown as InstalledGameEngineResource["game"],
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
				requestEditorLeaveFx: Effect.succeed(true),
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
		await vi.advanceTimersByTimeAsync(149);
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
				requestEditorLeaveFx: Effect.succeed(true),
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

	it("cancels native close before joining writes when an editor draft stays unsaved", async () => {
		const { rendererRuntime } = createTestRendererRuntime({
			createResourceFx: () => Effect.never,
		});
		runtimes.push(rendererRuntime);
		const lifecycle = createLifecycle();
		const router = createRouter();
		const remove = rendererRuntime.runSync(
			installRendererControlledCloseFx({
				lifecycle: lifecycle.lifecycle,
				requestEditorLeaveFx: Effect.succeed(false),
				rendererRuntime,
				router: router.router,
			}),
		);

		await expect(lifecycle.readBeforeClose()()).rejects.toThrow("unsaved changes");
		expect(router.navigate).not.toHaveBeenCalled();
		remove();
	});

	it("waits for admitted editor operations before selecting an active Game exit route", async () => {
		const idle = Effect.runSync(Deferred.make<void>());
		const resource = createResource("package:editor-idle");
		const repository: ProjectRepositoryService = {
			...UnusedEditorProjectRepository,
			awaitIdleFx: Deferred.await(idle),
			createProjectFx: () => Effect.die("Unexpected create."),
			listProjectsFx: Effect.die("Unexpected list."),
			readProjectFx: () => Effect.die("Unexpected read."),
			replaceConfigFx: () => Effect.die("Unexpected config save."),
			replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
			deleteItemFx: () => Effect.die("Unexpected item delete."),
			upsertItemFx: () => Effect.die("Unexpected item save."),
			upsertResourcesFx: () => Effect.die("Unexpected resource save."),
		};
		const { rendererRuntime } = createTestRendererRuntime({
			createResourceFx: () => Effect.succeed(resource),
			editorProjectRepository: repository,
		});
		runtimes.push(rendererRuntime);
		vi.useRealTimers();
		await rendererRuntime.runPromise(adoptTestGameEngineResourceFx("package:editor-idle"));
		vi.useFakeTimers();
		const lifecycle = createLifecycle();
		const router = createRouter();
		const remove = rendererRuntime.runSync(
			installRendererControlledCloseFx({
				lifecycle: lifecycle.lifecycle,
				requestEditorLeaveFx: Effect.succeed(true),
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
		expect(router.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/action/exit",
			params: {
				packageId: "package:editor-idle",
			},
			replace: true,
		});
		remove();
	});

	it("joins pending singleton creation before selecting the exact exit route", async () => {
		vi.useRealTimers();
		const resource = createResource("package:pending");
		const creation = Effect.runSync(Deferred.make<InstalledGameEngineResource>());
		const createResourceFx = vi.fn(() => Deferred.await(creation));
		const { rendererRuntime } = createTestRendererRuntime({
			createResourceFx,
		});
		runtimes.push(rendererRuntime);
		const scope = Effect.runSync(Scope.make());
		const acquisition = rendererRuntime.runPromise(
			GameEngineResourceFx.pipe(
				Effect.flatMap((service) =>
					service.acquireLeaseFx({
						packageId: "package:pending",
					}),
				),
				Effect.provideService(Scope.Scope, scope),
			),
		);
		const lifecycle = createLifecycle();
		const router = createRouter();
		const remove = rendererRuntime.runSync(
			installRendererControlledCloseFx({
				lifecycle: lifecycle.lifecycle,
				requestEditorLeaveFx: Effect.succeed(true),
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
