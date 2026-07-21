import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";

export namespace discardFailedGameEngineFx {
	export interface Props {
		readonly packageId: string;
		readonly queryClient: QueryClient;
	}
}

/** Removes only one exact idle failed singleton query without deleting any save. */
export const discardFailedGameEngineFx = Effect.fn("discardFailedGameEngineFx")(
	({ packageId, queryClient }: discardFailedGameEngineFx.Props) =>
		Effect.gen(function* () {
			const query = queryClient.getQueryCache().find({
				exact: true,
				queryKey: gameEngineQueryKey,
			});
			if (
				query === undefined ||
				query.state.status !== "error" ||
				query.state.fetchStatus !== "idle" ||
				query.state.data !== undefined
			) {
				return yield* Effect.fail(
					new Error("Failed Game exit requires one exact idle failed singleton query."),
				);
			}
			if (query.meta?.packageId !== packageId) {
				return yield* Effect.fail(
					new Error("Failed Game exit package identity does not match its query."),
				);
			}
			if (query.state.error instanceof GameSaveBootstrapError) {
				return yield* Effect.fail(
					new Error("Verified save failures require exact save cleanup before exit."),
				);
			}
			yield* Effect.sync(() =>
				queryClient.removeQueries({
					exact: true,
					queryKey: gameEngineQueryKey,
				}),
			);
		}),
);
