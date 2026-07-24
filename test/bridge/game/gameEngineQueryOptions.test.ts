import { QueryClient } from "@tanstack/react-query";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import { acquireGameEngineLeaseFx } from "~/bridge/game/acquireGameEngineLeaseFx";
import { getCachedGameEngineResourceFx } from "~/bridge/game/getCachedGameEngineResourceFx";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { gameEngineQueryOptions } from "~/bridge/game/gameEngineQueryOptions";
import { waitForGameEngineResourceFx } from "~/bridge/game/waitForGameEngineResourceFx";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { createTestGameTransitionFields } from "~test/support/game/createTestGameTransitionFields";
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
		trust: {
			type: "external",
			reason: "unsigned",
		} as const,
		source: "imported",
	},
	config: testArkpackConfig,
	disposeFx: Effect.void,
	disposeWithoutSaveFx,
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	...createTestGameTransitionFields(() => ({}) as ReturnType<Game["getSnapshot"]>),
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

const runFx = async <Value, Error>(effect: Effect.Effect<Value, Error>): Promise<Value> => {
	const exit = await Effect.runPromiseExit(effect);
	if (Exit.isSuccess(exit)) return exit.value;
	const failure = Cause.failureOption(exit.cause);
	if (Option.isSome(failure)) throw failure.value;
	throw Cause.squash(exit.cause);
};

const acquireGameEngineResource = (props: acquireGameEngineLeaseFx.Props) =>
	runFx(acquireGameEngineLeaseFx(props));

const getCachedGameEngineResource = (queryClient: QueryClient) =>
	Effect.runSync(getCachedGameEngineResourceFx(queryClient));

const waitForGameEngineResource = (queryClient: QueryClient) =>
	runFx(waitForGameEngineResourceFx(queryClient));

describe("gameEngineQueryOptions", () => {
	it("deduplicates repeated route acquisition through one renderer-wide query slot", async () => {
		const game = createGame();
		const create = vi.fn(async () => game);
		const rememberPackage = vi.fn(() => Promise.resolve());
		const client = createClient();
		const options = gameEngineQueryOptions({
			packageId: "package:test",
			create,
			rememberPackage,
		});

		const first = await client.ensureQueryData(options);
		const second = await client.ensureQueryData(options);

		expect(options.queryKey).toBe(gameEngineQueryKey);
		expect(options.meta).toEqual({
			packageId: "package:test",
		});
		expect(first.game.arkpack).toBe(game.arkpack);
		expect(second).toBe(first);
		expect(create).toHaveBeenCalledOnce();
		expect(rememberPackage).toHaveBeenCalledOnce();
		expect(rememberPackage).toHaveBeenCalledWith("package:test");
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

		expect((await client.ensureQueryData(options)).game.arkpack).toBe(first.arkpack);
		client.removeQueries({
			exact: true,
			queryKey: gameEngineQueryKey,
		});
		expect((await client.ensureQueryData(options)).game.arkpack).toBe(second.arkpack);
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

	it("lets controlled close adopt a provisional route result before that route aborts", async () => {
		let resolveCreate!: (game: Game) => void;
		const creation = new Promise<Game>((resolve) => {
			resolveCreate = resolve;
		});
		const discard = vi.fn();
		const game = createGame("package:close-pending", {
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		const client = createClient();
		const controller = new AbortController();
		const acquisition = acquireGameEngineResource({
			packageId: "package:close-pending",
			queryClient: client,
			signal: controller.signal,
			create: () => creation,
			rememberPackage: () => Promise.resolve(),
		});
		const joined = waitForGameEngineResource(client);
		resolveCreate(game);

		const resource = await joined;
		expect(resource).not.toBeNull();
		await acquisition;
		controller.abort();

		expect(discard).not.toHaveBeenCalled();
		expect(getCachedGameEngineResource(client)).toBe(resource);
	});

	it("discards a late-created provisional Game after its route owner aborts", async () => {
		let resolveCreate!: (game: Game) => void;
		const creation = new Promise<Game>((resolve) => {
			resolveCreate = resolve;
		});
		const discard = vi.fn();
		const game = createGame("package:aborted", {
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		const create = vi.fn(() => creation);
		const client = createClient();
		const controller = new AbortController();
		const acquisition = acquireGameEngineResource({
			packageId: "package:aborted",
			queryClient: client,
			signal: controller.signal,
			create,
			rememberPackage: () => Promise.resolve(),
		});
		await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());

		controller.abort();
		resolveCreate(game);

		await expect(acquisition).rejects.toMatchObject({
			name: "AbortError",
		});
		await vi.waitFor(() => expect(discard).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(client.getQueryState(gameEngineQueryKey)).toBeUndefined());
		expect(getCachedGameEngineResource(client)).toBeNull();
	});

	it("keeps a failed abort cleanup fatal and blocks every successor acquisition", async () => {
		let resolveCreate!: (game: Game) => void;
		const creation = new Promise<Game>((resolve) => {
			resolveCreate = resolve;
		});
		const disposalFailure = new Error("provisional disposal failed");
		const firstGame = createGame("package:first", {
			disposeWithoutSaveFx: Effect.fail(disposalFailure),
		});
		const secondGame = createGame("package:second");
		const create = vi.fn((selectedPackageId: string) =>
			selectedPackageId === "package:first" ? creation : Promise.resolve(secondGame),
		);
		const client = createClient();
		const controller = new AbortController();
		const first = acquireGameEngineResource({
			packageId: "package:first",
			queryClient: client,
			signal: controller.signal,
			create,
			rememberPackage: () => Promise.resolve(),
		});
		await vi.waitFor(() =>
			expect(create).toHaveBeenCalledWith("package:first", expect.anything()),
		);

		controller.abort();
		resolveCreate(firstGame);
		await expect(first).rejects.toMatchObject({
			name: "AbortError",
		});
		await vi.waitFor(() =>
			expect(client.getQueryState(gameEngineQueryKey)?.error).toBeInstanceOf(
				CriticalGameLifecycleError,
			),
		);

		const successor = acquireGameEngineResource({
			packageId: "package:second",
			queryClient: client,
			create,
			rememberPackage: () => Promise.resolve(),
		});
		await expect(successor).rejects.toBeInstanceOf(CriticalGameLifecycleError);
		await expect(successor).rejects.toMatchObject({
			operation: "engine-ownership",
		});
		await expect(successor).rejects.toThrow("provisional disposal failed");
		expect(create).toHaveBeenCalledOnce();
		expect(getCachedGameEngineResource(client)).toBeNull();
	});

	it("keeps a non-abort critical cleanup failure as the sole owner for every successor", async () => {
		const disposalFailure = new Error("contract-violating Game disposal failed");
		const wrongGame = createGame("package:wrong", {
			disposeWithoutSaveFx: Effect.fail(disposalFailure),
		});
		const create = vi.fn(async () => wrongGame);
		const client = createClient();
		const firstFailure = await acquireGameEngineResource({
			packageId: "package:expected",
			queryClient: client,
			create,
			rememberPackage: () => Promise.resolve(),
		}).then(
			() => undefined,
			(cause: unknown) => cause,
		);

		expect(firstFailure).toBeInstanceOf(CriticalGameLifecycleError);
		expect(firstFailure).toMatchObject({
			operation: "engine-ownership",
		});
		expect(firstFailure).toHaveProperty(
			"message",
			expect.stringContaining(disposalFailure.message),
		);

		for (const packageId of [
			"package:expected",
			"package:different",
		]) {
			const successorFailure = await acquireGameEngineResource({
				packageId,
				queryClient: client,
				create,
				rememberPackage: () => Promise.resolve(),
			}).then(
				() => undefined,
				(cause: unknown) => cause,
			);
			expect(successorFailure).toBeInstanceOf(CriticalGameLifecycleError);
			expect(Cause.originalError(successorFailure)).toBe(Cause.originalError(firstFailure));
		}

		expect(create).toHaveBeenCalledOnce();
		expect(getCachedGameEngineResource(client)).toBeNull();
	});

	it("cancels and fully discards a different-package acquisition before creating its successor", async () => {
		let resolveFirst!: (game: Game) => void;
		const firstCreation = new Promise<Game>((resolve) => {
			resolveFirst = resolve;
		});
		const discardFirst = vi.fn();
		const firstGame = createGame("package:first", {
			disposeWithoutSaveFx: Effect.sync(discardFirst),
		});
		const secondGame = createGame("package:second");
		const create = vi.fn((selectedPackageId: string) =>
			selectedPackageId === "package:first" ? firstCreation : Promise.resolve(secondGame),
		);
		const client = createClient();
		const first = acquireGameEngineResource({
			packageId: "package:first",
			queryClient: client,
			create,
			rememberPackage: () => Promise.resolve(),
		});
		await vi.waitFor(() =>
			expect(create).toHaveBeenCalledWith("package:first", expect.anything()),
		);

		const second = acquireGameEngineResource({
			packageId: "package:second",
			queryClient: client,
			create,
			rememberPackage: () => Promise.resolve(),
		});
		expect(create).toHaveBeenCalledOnce();
		resolveFirst(firstGame);

		await expect(first).rejects.toMatchObject({
			name: "AbortError",
		});
		const secondLease = await second;
		expect(getCachedGameEngineResource(client)).toBeNull();
		const secondResource = Effect.runSync(secondLease.adoptFx);

		expect(discardFirst).toHaveBeenCalledOnce();
		expect(create).toHaveBeenCalledTimes(2);
		expect(create).toHaveBeenLastCalledWith("package:second", expect.anything());
		expect(secondResource.game.arkpack.packageId).toBe("package:second");
		expect(getCachedGameEngineResource(client)).toBe(secondResource);
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

	it("does not block a valid Game when remembering lastPackageId fails", async () => {
		const game = createGame();
		const client = createClient();
		const resource = await client.ensureQueryData(
			gameEngineQueryOptions({
				packageId: "package:test",
				create: async () => game,
				rememberPackage: () => Promise.reject(new Error("preference unavailable")),
			}),
		);

		expect(resource.game.arkpack).toBe(game.arkpack);
		expect(getCachedGameEngineResource(client)).toBe(resource);
	});

	it("discards a contract-breaking Game returned for another package", async () => {
		const discard = vi.fn();
		const client = createClient();
		const game = createGame("package:wrong", {
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		const rememberPackage = vi.fn(() => Promise.resolve());

		const acquisition = client.ensureQueryData(
			gameEngineQueryOptions({
				packageId: "package:expected",
				create: async () => game,
				rememberPackage,
			}),
		);
		await expect(acquisition).rejects.toBeInstanceOf(CriticalGameLifecycleError);
		await expect(acquisition).rejects.toThrow("returned package package:wrong");
		expect(discard).toHaveBeenCalledOnce();
		expect(rememberPackage).not.toHaveBeenCalled();
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
