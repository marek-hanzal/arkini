import { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import { getCachedGameEngineResource } from "~/bridge/game/getCachedGameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { gameEngineQueryOptions } from "~/bridge/game/gameEngineQueryOptions";
import { waitForGameEngineResource } from "~/bridge/game/waitForGameEngineResource";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { testGameRead } from "~test/support/game/testGameRead";

const createGame = (
	packageId = "package:test",
	{
		disposeWithoutSaveFx = Effect.void,
	}: {
		readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
	} = {},
): Game => ({
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

const createClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

describe("gameEngineQueryOptions", () => {
	it("deduplicates repeated route acquisition through one renderer-wide query slot", async () => {
		const game = createGame();
		const create = vi.fn(async () => game);
		const client = createClient();
		const options = gameEngineQueryOptions({
			packageId: "package:test",
			create,
		});

		const first = await client.ensureQueryData(options);
		const second = await client.ensureQueryData(options);

		expect(options.queryKey).toBe(gameEngineQueryKey);
		expect(first.game).toBe(game);
		expect(second).toBe(first);
		expect(create).toHaveBeenCalledOnce();
		expect(getCachedGameEngineResource(client)).toBe(first);
	});

	it("creates a fresh Game only after explicit singleton cache removal", async () => {
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
			queryKey: gameEngineQueryKey,
		});
		expect((await client.ensureQueryData(options)).game).toBe(second);
		expect(create).toHaveBeenCalledTimes(2);
	});

	it("lets controlled close and HMR join creation before heavy bootstrap starts", async () => {
		let allowCreate!: () => void;
		const beforeCreate = new Promise<void>((resolve) => {
			allowCreate = resolve;
		});
		const game = createGame();
		const create = vi.fn(async () => game);
		const client = createClient();
		const acquisition = client.ensureQueryData(
			gameEngineQueryOptions({
				packageId: "package:test",
				beforeCreate: () => beforeCreate,
				create,
			}),
		);

		const joined = waitForGameEngineResource(client);
		expect(create).not.toHaveBeenCalled();
		allowCreate();

		expect(await joined).toBe(await acquisition);
		expect(create).toHaveBeenCalledOnce();
	});

	it("treats a failed pending creation as no live resource", async () => {
		let rejectCreate!: (error: Error) => void;
		const creation = new Promise<Game>((_resolve, reject) => {
			rejectCreate = reject;
		});
		const client = createClient();
		const acquisition = client
			.ensureQueryData(
				gameEngineQueryOptions({
					packageId: "package:test",
					create: () => creation,
				}),
			)
			.catch(() => undefined);

		const joined = waitForGameEngineResource(client);
		rejectCreate(new Error("bootstrap failed"));

		expect(await joined).toBeNull();
		await acquisition;
	});

	it("discards a contract-breaking Game returned for another package", async () => {
		const discard = vi.fn();
		const client = createClient();
		const game = createGame("package:wrong", {
			disposeWithoutSaveFx: Effect.sync(discard),
		});

		const acquisition = client.ensureQueryData(
			gameEngineQueryOptions({
				packageId: "package:expected",
				create: async () => game,
			}),
		);
		await expect(acquisition).rejects.toBeInstanceOf(CriticalGameLifecycleError);
		await expect(acquisition).rejects.toThrow("returned package package:wrong");
		expect(discard).toHaveBeenCalledOnce();
		expect(getCachedGameEngineResource(client)).toBeNull();
	});

	it("turns a rejected previous HMR shutdown into one fatal lifecycle error", async () => {
		const client = createClient();
		const create = vi.fn(async () => createGame());
		const acquisition = client.ensureQueryData(
			gameEngineQueryOptions({
				packageId: "package:test",
				awaitPreviousShutdown: Promise.reject(new Error("shutdown failed")),
				create,
			}),
		);

		await expect(acquisition).rejects.toMatchObject({
			operation: "hmr-handoff",
		});
		expect(create).not.toHaveBeenCalled();
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
});
