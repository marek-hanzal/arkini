import { QueryClient } from "@tanstack/react-query";
import { Effect, Exit } from "effect";
import { describe, expect, it, vi } from "vitest";

import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { recoverFailedGameSaveFx } from "~/bridge/game/recoverFailedGameSaveFx";

const packageId = "package-recovery";
const queryKey = gameEngineQueryKey(packageId);
const saveKey = {
	packageId,
	contentHash: "a".repeat(64),
};

const cacheFailure = async (queryClient: QueryClient, error: unknown) => {
	await queryClient
		.fetchQuery({
			queryKey,
			queryFn: () => Promise.reject(error),
			retry: false,
		})
		.catch(() => undefined);
};

describe("recoverFailedGameSaveFx", () => {
	it("clears and removes only the exact verified failed Game query", async () => {
		const queryClient = new QueryClient();
		const clear = vi.fn();
		await cacheFailure(
			queryClient,
			new GameSaveBootstrapError({
				cause: new Error("invalid save"),
				saveKey,
			}),
		);

		await Effect.runPromise(
			recoverFailedGameSaveFx({
				clearSaveFx: Effect.sync(clear),
				packageId,
				queryClient,
			}),
		);

		expect(clear).toHaveBeenCalledOnce();
		expect(queryClient.getQueryState(queryKey)).toBeUndefined();
	});

	it("retains the failed query when exact save clearing fails", async () => {
		const queryClient = new QueryClient();
		const failure = new Error("clear failed");
		await cacheFailure(
			queryClient,
			new GameSaveBootstrapError({
				cause: new Error("invalid save"),
				saveKey,
			}),
		);

		const exit = await Effect.runPromiseExit(
			recoverFailedGameSaveFx({
				clearSaveFx: Effect.fail(failure),
				packageId,
				queryClient,
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		expect(queryClient.getQueryState(queryKey)?.error).toBeInstanceOf(GameSaveBootstrapError);
	});

	it("rejects recovery without a verified bootstrap save failure", async () => {
		const queryClient = new QueryClient();
		await cacheFailure(queryClient, new Error("package failure"));

		const exit = await Effect.runPromiseExit(
			recoverFailedGameSaveFx({
				clearSaveFx: Effect.void,
				packageId,
				queryClient,
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		expect(queryClient.getQueryState(queryKey)).toBeDefined();
	});
});
