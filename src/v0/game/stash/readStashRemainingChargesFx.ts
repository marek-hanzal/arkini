import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readStashRemainingChargesFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		stashId: string;
		stashItemInstanceId: string;
	}
}

export const readStashRemainingChargesFx = Effect.fn("readStashRemainingChargesFx")(function* ({
	config,
	save,
	stashId,
	stashItemInstanceId,
}: readStashRemainingChargesFx.Props) {
	return (
		save.stashes[stashItemInstanceId]?.remainingCharges ?? config.stashes[stashId]?.charges ?? 0
	);
});
