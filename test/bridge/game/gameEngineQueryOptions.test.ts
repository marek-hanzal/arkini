import { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { findCachedGameEngine } from "~/bridge/game/findCachedGameEngine";
import { gameEngineQueryKey, gameEngineQueryOptions } from "~/bridge/game/gameEngineQueryOptions";

const createGame = (instanceKey: string, packageId = "package:test") =>
	({
		arkpack: {
			packageId,
		},
		disposeFx: Effect.void,
		disposeWithoutSaveFx: Effect.void,
		flushSaveFx: Effect.void,
		instanceKey,
		saveKey: {
			packageId,
			contentHash: "hash:test",
		},
	}) as Game;

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
		const game = createGame("instance:first");
		const create = vi.fn(async () => game);
		const client = createClient();
		const options = gameEngineQueryOptions({
			packageId: "package:test",
			create,
		});

		const first = await client.ensureQueryData(options);
		const second = await client.ensureQueryData(options);

		expect(first).toBe(game);
		expect(second).toBe(game);
		expect(create).toHaveBeenCalledOnce();
		expect(findCachedGameEngine(client)).toEqual({
			game,
			packageId: "package:test",
		});
	});

	it("creates a fresh Game only after explicit cache removal", async () => {
		const first = createGame("instance:first");
		const second = createGame("instance:second");
		const create = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
		const client = createClient();
		const options = gameEngineQueryOptions({
			packageId: "package:test",
			create,
		});

		expect(await client.ensureQueryData(options)).toBe(first);
		client.removeQueries({
			exact: true,
			queryKey: gameEngineQueryKey("package:test"),
		});
		expect(await client.ensureQueryData(options)).toBe(second);
		expect(create).toHaveBeenCalledTimes(2);
	});

	it("rejects an impossible cache containing multiple live Games", () => {
		const client = createClient();
		client.setQueryData(
			gameEngineQueryKey("package:first"),
			createGame("first", "package:first"),
		);
		client.setQueryData(
			gameEngineQueryKey("package:second"),
			createGame("second", "package:second"),
		);

		expect(() => findCachedGameEngine(client)).toThrow(
			"Arkini cannot own more than one cached live Game.",
		);
	});
});
