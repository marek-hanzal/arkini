import { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { closeGameEngineResourceFx } from "~/bridge/game/closeGameEngineResourceFx";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { releaseGameEngineResourceFx } from "~/bridge/game/releaseGameEngineResourceFx";
import { resetGameEngineResourceFx } from "~/bridge/game/resetGameEngineResourceFx";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

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
		expect(disposeOld).toHaveBeenCalledOnce();
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
