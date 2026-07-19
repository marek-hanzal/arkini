import { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { findCachedGameEngine } from "~/bridge/game/findCachedGameEngine";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { releaseGameEngineResourceFx } from "~/bridge/game/releaseGameEngineResourceFx";
import { resetGameEngineResourceFx } from "~/bridge/game/resetGameEngineResourceFx";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

const createGame = ({
	disposeFx = Effect.void,
	disposeWithoutSaveFx = Effect.void,
}: {
	readonly disposeFx?: Game["disposeFx"];
	readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
} = {}): Game => ({
	arkpack: {
		packageId: "package:lifecycle",
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
		packageId: "package:lifecycle",
		contentHash: "0".repeat(64),
	},
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const createHarness = (game: Game) => {
	const queryClient = new QueryClient();
	const resource = Effect.runSync(createGameEngineResourceFx(game));
	queryClient.setQueryData(gameEngineQueryKey(game.arkpack.packageId), resource);
	return {
		queryClient,
		resource,
	};
};

describe("GameEngineResource lifecycle", () => {
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
		expect(findCachedGameEngine(queryClient)).toBeNull();
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
		expect(findCachedGameEngine(queryClient)?.resource).toBe(resource);
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
		expect(findCachedGameEngine(queryClient)?.resource).toBe(resource);

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
		expect(findCachedGameEngine(queryClient)).toBeNull();
	});
});
