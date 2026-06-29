import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { doesGameGrantSelectorMatchIds } from "~/v0/game/effects/doesGameGrantSelectorMatchIds";
import { readGameEffectTargetGrantIds } from "~/v0/game/effects/readGameEffectTargetGrantIds";

export namespace checkGameEffectGrantSelectorFx {
	export interface Props {
		config: GameConfig;
		missingReason: string;
		nowMs?: number;
		save: GameSave;
		selector: NonNullable<GameConfig["items"][string]["grantSelector"]> | undefined;
		target: readGameEffectTargetGrantIds.Target;
	}
}

export const checkGameEffectGrantSelectorFx = Effect.fn("checkGameEffectGrantSelectorFx")(
	function* ({
		config,
		missingReason,
		nowMs,
		save,
		selector,
		target,
	}: checkGameEffectGrantSelectorFx.Props) {
		if (!selector) return;

		const grantIds = readGameEffectTargetGrantIds({
			config,
			nowMs,
			save,
			target,
		});
		if (
			doesGameGrantSelectorMatchIds({
				grantIds,
				selector,
			})
		)
			return;

		return yield* Effect.fail(
			GameEngineError.actionRejected("effect:missing-grant", missingReason),
		);
	},
);
