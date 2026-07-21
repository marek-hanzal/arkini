import { QueryClient } from "@tanstack/react-query";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import { discardFailedGameEngineFx } from "~/bridge/game/discardFailedGameEngineFx";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";

const packageId = "package-failed-exit";

const cacheFailure = async ({
	error,
	packageId: failedPackageId = packageId,
	queryClient,
}: {
	readonly error: unknown;
	readonly packageId?: string;
	readonly queryClient: QueryClient;
}) => {
	await queryClient
		.fetchQuery({
			queryKey: gameEngineQueryKey,
			queryFn: () => Promise.reject(error),
			meta: {
				packageId: failedPackageId,
			},
			retry: false,
		})
		.catch(() => undefined);
};

describe("discardFailedGameEngineFx", () => {
	it("removes only the exact idle ordinary failed Game query", async () => {
		const queryClient = new QueryClient();
		await cacheFailure({
			error: new Error("package bootstrap failed"),
			queryClient,
		});

		await Effect.runPromise(
			discardFailedGameEngineFx({
				packageId,
				queryClient,
			}),
		);

		expect(queryClient.getQueryState(gameEngineQueryKey)).toBeUndefined();
	});

	it("retains a failed query owned by another package", async () => {
		const queryClient = new QueryClient();
		await cacheFailure({
			error: new Error("package bootstrap failed"),
			packageId: "package-other",
			queryClient,
		});

		const exit = await Effect.runPromiseExit(
			discardFailedGameEngineFx({
				packageId,
				queryClient,
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		expect(queryClient.getQueryState(gameEngineQueryKey)?.status).toBe("error");
	});

	it("never removes a published replacement resource", async () => {
		const queryClient = new QueryClient();
		const replacement = {
			owner: "replacement",
		};
		queryClient.setQueryData(gameEngineQueryKey, replacement);

		const exit = await Effect.runPromiseExit(
			discardFailedGameEngineFx({
				packageId,
				queryClient,
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		expect(queryClient.getQueryData(gameEngineQueryKey)).toBe(replacement);
	});

	it("refuses to discard a verified save failure without exact save cleanup", async () => {
		const queryClient = new QueryClient();
		await cacheFailure({
			error: new GameSaveBootstrapError({
				cause: new Error("invalid save"),
				saveKey: {
					packageId,
					contentHash: "a".repeat(64),
				},
			}),
			queryClient,
		});

		const exit = await Effect.runPromiseExit(
			discardFailedGameEngineFx({
				packageId,
				queryClient,
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		expect(queryClient.getQueryState(gameEngineQueryKey)?.error).toBeInstanceOf(
			GameSaveBootstrapError,
		);
	});
});
