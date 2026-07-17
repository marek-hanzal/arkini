import { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import type { GameOwner } from "~/bridge/game/GameOwner";
import { hardResetGameMutationOptions } from "~/ui/game-menu/mutation/hardResetGameMutationOptions";
import { saveAndExitGameMutationOptions } from "~/ui/game-menu/mutation/saveAndExitGameMutationOptions";
import { saveGameMutationOptions } from "~/ui/game-menu/mutation/saveGameMutationOptions";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

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
	instanceKey: "game-instance:menu",
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx,
	getResourceUrl: () => "blob:test",
	getSnapshot: () => ({}) as ReturnType<Game["getSnapshot"]>,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

const createOwner = ({
	releaseRouteGameFx = Effect.void,
	hardResetFx = Effect.void,
}: {
	readonly releaseRouteGameFx?: Effect.Effect<void, unknown>;
	readonly hardResetFx?: Effect.Effect<void, unknown>;
} = {}): GameOwner => ({
	getSnapshot: () => ({
		type: "loading",
		packageId: null,
	}),
	selectPackageFx: () => Effect.void,
	releaseRouteGameFx: () => releaseRouteGameFx,
	shutdownFx: () => Effect.void,
	clearFailedSaveAndRetryFx: () => Effect.void,
	hardResetFx: () => hardResetFx,
	subscribe: () => () => undefined,
});

const executeMutation = async (
	options:
		| ReturnType<typeof saveGameMutationOptions>
		| ReturnType<typeof saveAndExitGameMutationOptions>
		| ReturnType<typeof hardResetGameMutationOptions>,
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

	it("owns safe route release without calling application shutdown", async () => {
		const release = vi.fn();
		const shutdown = vi.fn();
		const game = createGame();
		const owner = {
			...createOwner({
				releaseRouteGameFx: Effect.sync(release),
			}),
			shutdownFx: () => Effect.sync(shutdown),
		} satisfies GameOwner;
		const options = saveAndExitGameMutationOptions({
			game,
			owner,
		});

		expect(options.mutationKey).toEqual([
			"game",
			"save-and-exit",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		]);
		await executeMutation(options);
		expect(release).toHaveBeenCalledOnce();
		expect(shutdown).not.toHaveBeenCalled();
	});

	it("owns the canonical hard reset and preserves its failure", async () => {
		const failure = new Error("reset failed");
		const game = createGame();
		const options = hardResetGameMutationOptions({
			game,
			owner: createOwner({
				hardResetFx: Effect.fail(failure),
			}),
		});

		expect(options.mutationKey).toEqual([
			"game",
			"hard-reset",
			game.saveKey.packageId,
			game.saveKey.contentHash,
		]);
		await expect(executeMutation(options)).rejects.toThrow("reset failed");
	});
});
