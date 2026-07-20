import { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { saveAndExitGameMutationOptions } from "~/ui/game-menu/mutation/saveAndExitGameMutationOptions";
import { saveGameMutationOptions } from "~/ui/game-menu/mutation/saveGameMutationOptions";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { testGameRead } from "~test/support/game/testGameRead";

const createGame = (flushSaveFx: Game["flushSaveFx"] = Effect.void): Game => ({
	arkpack: {
		packageId: "package:menu",
		contentHash: "content:menu",
		gameId: "game:menu",
		title: "Menu game",
		configVersion: "1.0",
		compressedSize: 0,
		source: "imported",
	},
	config: testArkpackConfig,
	saveKey: {
		packageId: "package:menu",
		contentHash: "a".repeat(64),
	},
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx,
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	read: testGameRead,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const executeMutation = async (
	options:
		| ReturnType<typeof saveGameMutationOptions>
		| ReturnType<typeof saveAndExitGameMutationOptions>,
) => {
	if (options.mutationFn === undefined) throw new Error("Expected a mutation function.");
	return options.mutationFn(undefined, {
		client: new QueryClient(),
		meta: options.meta,
		mutationKey: options.mutationKey,
	});
};

describe("game menu mutation options", () => {
	it("owns the complete explicit save contract and exact game identity", async () => {
		const flush = vi.fn();
		const game = createGame(Effect.sync(flush));
		const options = saveGameMutationOptions(game);

		expect(options.mutationKey).toEqual([
			"game",
			"save",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		]);
		expect(options.retry).toBe(false);
		await executeMutation(options);
		expect(flush).toHaveBeenCalledOnce();
	});

	it("owns the trusted native save-and-exit request for the exact game", async () => {
		const requestClose = vi.fn(() => Promise.reject(new Error("close rejected")));
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				arkini: {
					lifecycle: {
						requestClose,
					},
				},
			},
		});
		const game = createGame();
		const options = saveAndExitGameMutationOptions(game);

		expect(options.mutationKey).toEqual([
			"game",
			"save-and-exit",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		]);
		await expect(executeMutation(options)).rejects.toThrow("close rejected");
		expect(requestClose).toHaveBeenCalledOnce();
		Reflect.deleteProperty(globalThis, "window");
	});
});
