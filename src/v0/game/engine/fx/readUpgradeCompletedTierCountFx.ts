import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readUpgradeCompletedTierCountFx {
	export interface Props {
		save: GameSave;
		upgradeId: string;
	}
}

export const readUpgradeCompletedTierCountFx = Effect.fn("readUpgradeCompletedTierCountFx")(
	function* ({ save, upgradeId }: readUpgradeCompletedTierCountFx.Props) {
		return save.upgrades[upgradeId]?.completedTiers ?? 0;
	},
);
