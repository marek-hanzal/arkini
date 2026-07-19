import { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { findCachedGameEngine } from "~/bridge/game/findCachedGameEngine";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { gameEngineQueryOptions } from "~/bridge/game/gameEngineQueryOptions";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

const createGame = (packageId = "package:test"): Game => ({
	arkpack: {
		packageId,
		contentHash: "content:test",
		gameId: testArkpackConfig.meta.id,
		title: testArkpackConfig.meta.title,
		configVersion: testArkpackConfig.version,
		compressedSize: 0,
		source: "imported",
	},
	config: testArkpackConfig,
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
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

const createResource = (game: Game) => Effect.runSync(createGameEngineResourceFx(game));

const createClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

describe("gameEngineQueryOptions", () => {
	it("deduplicates repeated route acquisition to one stable Game instance", async () => {
		const game = createGame();
		const create = vi.fn(async () => game);
		const client = createClient();
		const options = gameEngineQueryOptions({
			packageId: "package:test",
			create,
		});

		const first = await client.ensureQueryData(options);
		const second = await client.ensureQueryData(options);

		expect(first.game).toBe(game);
		expect(second).toBe(first);
		expect(create).toHaveBeenCalledOnce();
		expect(findCachedGameEngine(client)).toEqual({
			game,
			packageId: "package:test",
			resource: first,
		});
	});

	it("creates a fresh Game only after explicit cache removal", async () => {
		const first = createGame();
		const second = createGame();
		const create = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
		const client = createClient();
		const options = gameEngineQueryOptions({
			packageId: "package:test",
			create,
		});

		expect((await client.ensureQueryData(options)).game).toBe(first);
		client.removeQueries({
			exact: true,
			queryKey: gameEngineQueryKey("package:test"),
		});
		expect((await client.ensureQueryData(options)).game).toBe(second);
		expect(create).toHaveBeenCalledTimes(2);
	});

	it("serializes overlapping route lifecycle actions for one cached Game", async () => {
		const game = createGame();
		const client = createClient();
		const resource = await client.ensureQueryData(
			gameEngineQueryOptions({
				packageId: "package:test",
				create: async () => game,
			}),
		);
		const order: string[] = [];
		let releaseFirst!: () => void;
		const firstGate = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const first = Effect.runPromise(
			resource.withLifecycleLockFx(
				Effect.promise(async () => {
					order.push("first:start");
					await firstGate;
					order.push("first:end");
				}),
			),
		);
		const second = Effect.runPromise(
			resource.withLifecycleLockFx(
				Effect.sync(() => {
					order.push("second");
				}),
			),
		);
		await Promise.resolve();
		expect(order).toEqual([
			"first:start",
		]);
		releaseFirst();
		await Promise.all([
			first,
			second,
		]);
		expect(order).toEqual([
			"first:start",
			"first:end",
			"second",
		]);
	});

	it("rejects an impossible cache containing multiple live Games", () => {
		const client = createClient();
		client.setQueryData(
			gameEngineQueryKey("package:first"),
			createResource(createGame("package:first")),
		);
		client.setQueryData(
			gameEngineQueryKey("package:second"),
			createResource(createGame("package:second")),
		);

		expect(() => findCachedGameEngine(client)).toThrow(
			"Arkini cannot own more than one cached live Game.",
		);
	});
});
