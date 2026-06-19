import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import { readRuntimeActivationRequirementViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationRequirementViewsFromGameSave";

export namespace readRuntimeStashActivationViewFromGameSave {
	export interface Props {
		boardItem: GameSaveBoardItem;
		config: GameConfig;
		save: GameSave;
	}
}

export const readRuntimeStashActivationViewFromGameSave = ({
	boardItem,
	config,
	save,
}: readRuntimeStashActivationViewFromGameSave.Props): ActivationView | undefined => {
	const item = config.items[boardItem.itemId];
	const stashId = item?.stashId;
	const stash = stashId ? config.stashes[stashId] : undefined;
	if (!stashId || !stash) return undefined;

	return {
		inputs: stash.inputs.map((input) =>
			readRuntimeActivationInputView({
				input,
				stored: 0,
			}),
		),
		kind: "stash",
		remainingCharges: save.stashes[boardItem.id]?.remainingCharges ?? stash.charges,
		requirements: readRuntimeActivationRequirementViewsFromGameSave({
			requirements: stash.requirements,
			save,
			targetItemInstanceId: boardItem.id,
		}),
		trigger: "click",
	};
};
