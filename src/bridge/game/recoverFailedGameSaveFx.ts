import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { gameEngineQueryKey } from "~/bridge/game/gameEngineQueryKey";
import { deleteGameSaveFx } from "~/bridge/save/deleteGameSaveFx";

export namespace recoverFailedGameSaveFx {
	export interface Props {
		readonly clearSaveFx?: Effect.Effect<void, unknown>;
		readonly packageId: string;
		readonly queryClient: QueryClient;
	}
}

/** Clears only the verified save behind one failed Game query, then removes that failed query. */
export const recoverFailedGameSaveFx = Effect.fn("recoverFailedGameSaveFx")(
	({ clearSaveFx, packageId, queryClient }: recoverFailedGameSaveFx.Props) =>
		Effect.gen(function* () {
			const queryKey = gameEngineQueryKey(packageId);
			const error = queryClient.getQueryState<GameEngineResource, unknown>(queryKey)?.error;
			if (!(error instanceof GameSaveBootstrapError)) {
				return yield* Effect.fail(
					new Error(
						"Game save recovery requires an exact verified bootstrap save failure.",
					),
				);
			}
			if (error.saveKey.packageId !== packageId) {
				return yield* Effect.fail(
					new Error(
						"Game save recovery package identity does not match its failed query.",
					),
				);
			}
			yield* clearSaveFx ??
				deleteGameSaveFx({
					key: error.saveKey,
				});
			yield* Effect.sync(() =>
				queryClient.removeQueries({
					exact: true,
					queryKey,
				}),
			);
		}),
);
