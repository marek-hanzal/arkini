import type { ItemTargetLimit } from "~/v0/game/limit/ItemTargetLimit";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readItemTargetLimits } from "~/v0/game/limit/readItemTargetLimits";
import { mergeItemTargetLimits } from "~/v0/game/limit/mergeItemTargetLimits";

type ActivationOutput = NonNullable<GameConfig["products"][string]["output"]>;

export namespace readOutputTargetLimits {
	export interface Props {
		config: GameConfig;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		includePendingCraftJobs?: boolean;
		includePendingCraftSourceItems?: boolean;
		includePendingProducerJobs?: boolean;
		nowMs?: number;
		output: ActivationOutput | undefined;
		save: GameSave;
	}
}

const readOutputQuantityMaximum = (
	quantity:
		| number
		| {
				max: number;
				min: number;
		  },
) => (typeof quantity === "number" ? quantity : quantity.max);

export const readOutputTargetLimits = ({
	config,
	ignoredBoardItemInstanceIds,
	includePendingCraftJobs,
	includePendingCraftSourceItems,
	includePendingProducerJobs,
	nowMs,
	output,
	save,
}: readOutputTargetLimits.Props): ItemTargetLimit[] => {
	if (!output) return [];

	return mergeItemTargetLimits(
		output.flatMap((outputEntry) => {
			if (outputEntry.type !== "guaranteed") return [];

			return readItemTargetLimits({
				config,
				ignoredBoardItemInstanceIds,
				includePendingCraftJobs,
				includePendingCraftSourceItems,
				includePendingProducerJobs,
				nowMs,
				itemId: outputEntry.itemId,
				requiredQuantity: readOutputQuantityMaximum(outputEntry.quantity),
				save,
			});
		}),
	);
};
