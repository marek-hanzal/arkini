import { Effect } from "effect";
import { applyGameActionFx } from "~/v0/game/engine/applyGameActionFx";
import { GameConfigFx } from "~/v0/game/config/GameConfigFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import type { GameActionReadiness } from "~/v0/game/action/GameActionReadinessSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";

export namespace readActionReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: unknown;
	}
}

export const readActionReadinessFx = Effect.fn("readActionReadinessFx")(function* ({
	config,
	nowMs,
	save,
	action,
}: readActionReadinessFx.Props) {
	const readinessEffect: Effect.Effect<void, GameEngineError, GameConfigFx | RandomServiceFx> =
		Effect.gen(function* () {
			const dryRunSave = yield* cloneGameSaveFx({
				save,
			});
			yield* applyGameActionFx({
				action,
				config,
				nowMs: nowMs ?? save.updatedAtMs,
				save: dryRunSave,
			});
		});

	return yield* Effect.provideService(readinessEffect, GameConfigFx, {
		config,
	}).pipe(
		Effect.match({
			onFailure: (error: GameEngineError) =>
				({
					errorTag: error._tag,
					message: error.message,
					...(error._tag === "GameActionRejected" || error._tag === "GamePlacementFailed"
						? {
								reason: error.reason,
							}
						: {}),
					type: "rejected" as const,
				}) satisfies GameActionReadiness,
			onSuccess: () =>
				({
					type: "ready" as const,
				}) satisfies GameActionReadiness,
		}),
	);
});
