import type { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { releaseGameEngineResourceFx } from "~/bridge/game/releaseGameEngineResourceFx";

export type CloseGameEngineResourceResult =
	| {
			readonly type: "saved";
	  }
	| {
			readonly type: "finalization-failed";
			readonly cause: unknown;
	  };

export namespace closeGameEngineResourceFx {
	export interface Props {
		readonly queryClient: QueryClient;
		readonly resource: GameEngineResource;
	}
}

/** Attempts one final save/disposal for native close and never blocks application exit. */
export const closeGameEngineResourceFx = Effect.fn("closeGameEngineResourceFx")(
	({ queryClient, resource }: closeGameEngineResourceFx.Props) =>
		releaseGameEngineResourceFx({
			queryClient,
			resource,
		}).pipe(
			Effect.match({
				onFailure: (cause) =>
					({
						type: "finalization-failed",
						cause,
					}) satisfies CloseGameEngineResourceResult,
				onSuccess: () =>
					({
						type: "saved",
					}) satisfies CloseGameEngineResourceResult,
			}),
		),
);
