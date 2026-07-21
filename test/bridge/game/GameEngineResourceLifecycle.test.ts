import { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import { closeGameEngineResourceFx } from "~/bridge/game/closeGameEngineResourceFx";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { releaseGameEngineResourceFx } from "~/bridge/game/releaseGameEngineResourceFx";
import { resetGameEngineResourceFx } from "~/bridge/game/resetGameEngineResourceFx";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { testGameRead } from "~test/support/game/testGameRead";

const createDeferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return {
		promise,
		resolve,
	};
};

const createGame = ({
	packageId = "package:lifecycle",
	disposeFx = Effect.void,
	disposeWithoutSaveFx = Effect.void,
}: {
	readonly packageId?: string;
	readonly disposeFx?: Game["disposeFx"];
	readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
} = {}): Game => ({
	arkpack: {
		packageId,
		contentHash: "content:lifecycle",
		gameId: testArkpackConfig.meta.id,
		title: testArkpackConfig.meta.title,
		configVersion: testArkpackConfig.version,
		compressedSize: 0,
		source: "imported",
	},
	config: testArkpackConfig,
	disposeFx,
	disposeWithoutSaveFx,
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	read: testGameRead,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	saveKey: {
		packageId,
		contentHash: "0".repeat(64),
	},
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const createHarness = (game: Game) => {
	const queryClient = new QueryClient();
	const resource = Effect.runSync(createGameEngineResourceFx(game));
	queryClient.setQueryData(gameEngineQueryKey, resource);
	return {
		queryClient,
		resource,
	};
};

describe("GameEngineResource lifecycle", () => {
	it("keeps the first critical failure as a permanent publication guard", () => {
		const { resource } = createHarness(createGame());
		const firstCause = new Error("final save failed");
		const first = resource.markCriticalFailure("game-leave", firstCause);
		const second = resource.markCriticalFailure("game-reset", new Error("later failure"));

		expect(second).toBe(first);
		expect(first.cause).toBe(firstCause);
		expect(() => resource.assertUsable()).toThrow(first);
	});

	it("marks unexpected live read failures critical and preserves the same fail-stop error", () => {
		const { resource } = createHarness(createGame());
		const failure = new Error("line projection invariant failed");

		expect(() => resource.game.readOrThrow(Effect.fail(failure))).toThrow(
			CriticalGameLifecycleError,
		);
		let critical: unknown;
		try {
			resource.assertUsable();
		} catch (cause) {
			critical = cause;
		}
		expect(critical).toBeInstanceOf(CriticalGameLifecycleError);
		expect((critical as CriticalGameLifecycleError).operation).toBe("game-read");
		expect((critical as CriticalGameLifecycleError).cause).toBe(failure);
	});

	it("removes the cached Game only after final save and disposal succeed", async () => {
		const dispose = vi.fn();
		const game = createGame({
			disposeFx: Effect.sync(dispose),
		});
		const { queryClient, resource } = createHarness(game);

		await Effect.runPromise(
			releaseGameEngineResourceFx({
				queryClient,
				resource,
			}),
		);

		expect(dispose).toHaveBeenCalledOnce();
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
	});

	it("retains the exact frozen Game when final save fails", async () => {
		const failure = new Error("disk full");
		const game = createGame({
			disposeFx: Effect.fail(failure),
		});
		const { queryClient, resource } = createHarness(game);

		await expect(
			Effect.runPromise(
				releaseGameEngineResourceFx({
					queryClient,
					resource,
				}),
			),
		).rejects.toThrow("disk full");
		expect(getCachedGameEngineResource(queryClient)).toBe(resource);
	});

	it("reports a failed close save without blocking native shutdown", async () => {
		const failure = new Error("disk full");
		const game = createGame({
			disposeFx: Effect.fail(failure),
		});
		const { queryClient, resource } = createHarness(game);

		const result = await Effect.runPromise(
			closeGameEngineResourceFx({
				queryClient,
				resource,
			}),
		);

		expect(result.type).toBe("finalization-failed");
		if (result.type === "finalization-failed") {
			expect(result.cause).toBeInstanceOf(Error);
			expect((result.cause as Error).message).toBe(failure.message);
		}
		expect(getCachedGameEngineResource(queryClient)).toBe(resource);
	});

	it("removes the singleton after a successful close save", async () => {
		const dispose = vi.fn();
		const game = createGame({
			disposeFx: Effect.sync(dispose),
		});
		const { queryClient, resource } = createHarness(game);

		const result = await Effect.runPromise(
			closeGameEngineResourceFx({
				queryClient,
				resource,
			}),
		);

		expect(result).toEqual({
			type: "saved",
		});
		expect(dispose).toHaveBeenCalledOnce();
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
	});

	it("does not let stale cleanup remove a newer singleton resource", async () => {
		const disposeOld = vi.fn();
		const oldResource = Effect.runSync(
			createGameEngineResourceFx(
				createGame({
					packageId: "package:old",
					disposeFx: Effect.sync(disposeOld),
				}),
			),
		);
		const newResource = Effect.runSync(
			createGameEngineResourceFx(
				createGame({
					packageId: "package:new",
				}),
			),
		);
		const queryClient = new QueryClient();
		queryClient.setQueryData(gameEngineQueryKey, newResource);

		await expect(
			Effect.runPromise(
				releaseGameEngineResourceFx({
					queryClient,
					resource: oldResource,
				}),
			),
		).rejects.toThrow("cannot remove a different or missing singleton resource");
		expect(disposeOld).not.toHaveBeenCalled();
		expect(getCachedGameEngineResource(queryClient)).toBe(newResource);
	});

	it("lets native close join a successful leave without disposing twice", async () => {
		const disposeStarted = createDeferred();
		const continueDispose = createDeferred();
		const dispose = vi.fn();
		const game = createGame({
			disposeFx: Effect.promise(async () => {
				dispose();
				disposeStarted.resolve();
				await continueDispose.promise;
			}),
		});
		const { queryClient, resource } = createHarness(game);
		const leave = Effect.runPromise(
			releaseGameEngineResourceFx({
				queryClient,
				resource,
			}),
		);
		await disposeStarted.promise;
		const close = Effect.runPromise(
			closeGameEngineResourceFx({
				queryClient,
				resource,
			}),
		);

		continueDispose.resolve();
		await leave;
		await expect(close).resolves.toEqual({
			type: "saved",
		});
		expect(dispose).toHaveBeenCalledOnce();
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
	});

	it("lets native close join a successful reset without final-saving twice", async () => {
		const discardStarted = createDeferred();
		const continueDiscard = createDeferred();
		const discard = vi.fn();
		const finalSave = vi.fn();
		const clearSave = vi.fn();
		const game = createGame({
			disposeFx: Effect.sync(finalSave),
			disposeWithoutSaveFx: Effect.promise(async () => {
				discard();
				discardStarted.resolve();
				await continueDiscard.promise;
			}),
		});
		const { queryClient, resource } = createHarness(game);
		const reset = Effect.runPromise(
			resetGameEngineResourceFx({
				clearSaveFx: Effect.sync(clearSave),
				queryClient,
				resource,
			}),
		);
		await discardStarted.promise;
		const close = Effect.runPromise(
			closeGameEngineResourceFx({
				queryClient,
				resource,
			}),
		);

		continueDiscard.resolve();
		await reset;
		await expect(close).resolves.toEqual({
			type: "saved",
		});
		expect(discard).toHaveBeenCalledOnce();
		expect(clearSave).toHaveBeenCalledOnce();
		expect(finalSave).not.toHaveBeenCalled();
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
	});

	it("lets HMR join a successful leave without disposing twice", async () => {
		const disposeStarted = createDeferred();
		const continueDispose = createDeferred();
		const dispose = vi.fn();
		const game = createGame({
			disposeFx: Effect.promise(async () => {
				dispose();
				disposeStarted.resolve();
				await continueDispose.promise;
			}),
		});
		const { queryClient, resource } = createHarness(game);
		const leave = Effect.runPromise(
			releaseGameEngineResourceFx({
				queryClient,
				resource,
			}),
		);
		await disposeStarted.promise;
		const hmr = Effect.runPromise(
			releaseGameEngineResourceFx({
				allowAlreadyFinalized: true,
				queryClient,
				resource,
			}),
		);

		continueDispose.resolve();
		await expect(
			Promise.all([
				leave,
				hmr,
			]),
		).resolves.toEqual([
			undefined,
			undefined,
		]);
		expect(dispose).toHaveBeenCalledOnce();
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
	});

	it("does not let a waiting leave dispose after native close wins", async () => {
		const disposeStarted = createDeferred();
		const continueDispose = createDeferred();
		const dispose = vi.fn();
		const game = createGame({
			disposeFx: Effect.promise(async () => {
				dispose();
				disposeStarted.resolve();
				await continueDispose.promise;
			}),
		});
		const { queryClient, resource } = createHarness(game);
		const close = Effect.runPromise(
			closeGameEngineResourceFx({
				queryClient,
				resource,
			}),
		);
		await disposeStarted.promise;
		const leave = Effect.runPromise(
			releaseGameEngineResourceFx({
				queryClient,
				resource,
			}),
		);

		continueDispose.resolve();
		await expect(close).resolves.toEqual({
			type: "saved",
		});
		await expect(leave).rejects.toThrow(
			"cannot remove a different or missing singleton resource",
		);
		expect(dispose).toHaveBeenCalledOnce();
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
	});

	it("does not let a waiting reset discard or clear after native close wins", async () => {
		const disposeStarted = createDeferred();
		const continueDispose = createDeferred();
		const finalSave = vi.fn();
		const discard = vi.fn();
		const clearSave = vi.fn();
		const game = createGame({
			disposeFx: Effect.promise(async () => {
				finalSave();
				disposeStarted.resolve();
				await continueDispose.promise;
			}),
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		const { queryClient, resource } = createHarness(game);
		const close = Effect.runPromise(
			closeGameEngineResourceFx({
				queryClient,
				resource,
			}),
		);
		await disposeStarted.promise;
		const reset = Effect.runPromise(
			resetGameEngineResourceFx({
				clearSaveFx: Effect.sync(clearSave),
				queryClient,
				resource,
			}),
		);

		continueDispose.resolve();
		await expect(close).resolves.toEqual({
			type: "saved",
		});
		await expect(reset).rejects.toThrow(
			"cannot remove a different or missing singleton resource",
		);
		expect(finalSave).toHaveBeenCalledOnce();
		expect(discard).not.toHaveBeenCalled();
		expect(clearSave).not.toHaveBeenCalled();
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
	});

	it("does not treat a replacement singleton as already finalized", async () => {
		const disposeOld = vi.fn();
		const oldResource = Effect.runSync(
			createGameEngineResourceFx(
				createGame({
					packageId: "package:old",
					disposeFx: Effect.sync(disposeOld),
				}),
			),
		);
		const newResource = Effect.runSync(
			createGameEngineResourceFx(
				createGame({
					packageId: "package:new",
				}),
			),
		);
		const queryClient = new QueryClient();
		queryClient.setQueryData(gameEngineQueryKey, newResource);

		await expect(
			Effect.runPromise(
				releaseGameEngineResourceFx({
					allowAlreadyFinalized: true,
					queryClient,
					resource: oldResource,
				}),
			),
		).rejects.toThrow("cannot remove a different or missing singleton resource");
		expect(disposeOld).not.toHaveBeenCalled();
		expect(getCachedGameEngineResource(queryClient)).toBe(newResource);
	});

	it("keeps a spent reset resource retryable until exact save clearing succeeds", async () => {
		const order: string[] = [];
		let clearAttempts = 0;
		const game = createGame({
			disposeWithoutSaveFx: Effect.sync(() => order.push("discard")),
		});
		const { queryClient, resource } = createHarness(game);
		const clearSaveFx = Effect.suspend(() => {
			clearAttempts += 1;
			order.push(`clear:${clearAttempts}`);
			return clearAttempts === 1 ? Effect.fail(new Error("clear failed")) : Effect.void;
		});

		await expect(
			Effect.runPromise(
				resetGameEngineResourceFx({
					clearSaveFx,
					queryClient,
					resource,
				}),
			),
		).rejects.toThrow("clear failed");
		expect(getCachedGameEngineResource(queryClient)).toBe(resource);

		await Effect.runPromise(
			resetGameEngineResourceFx({
				clearSaveFx,
				queryClient,
				resource,
			}),
		);
		expect(order).toEqual([
			"discard",
			"clear:1",
			"discard",
			"clear:2",
		]);
		expect(getCachedGameEngineResource(queryClient)).toBeNull();
	});
});
