import type { ItemTargetLimit } from "~/limit/ItemTargetLimit";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readItemTargetLimits } from "~/limit/readItemTargetLimits";
import { mergeItemTargetLimits } from "~/limit/mergeItemTargetLimits";

type ActivationOutputEntry = NonNullable<GameLineDefinition["output"]>[number]["entries"][number];

export namespace readOutputTargetLimits {
	export interface Props {
		config: GameConfig;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		includePendingCraftJobs?: boolean;
		includePendingCraftSourceItems?: boolean;
		includePendingProducerJobs?: boolean;
		nowMs?: number;
		output: readonly ActivationOutputEntry[] | undefined;
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
