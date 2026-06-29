import type { ItemTargetLimit } from "~/v0/game/limit/ItemTargetLimit";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readItemTargetLimits } from "~/v0/game/limit/readItemTargetLimits";

type ActivationOutput = NonNullable<GameConfig["products"][string]["output"]>;

export namespace readOutputTargetLimits {
	export interface Props {
		config: GameConfig;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
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

const mergeLimits = (views: ItemTargetLimit[]) => {
	const merged = new Map<string, ItemTargetLimit>();

	for (const view of views) {
		const existing = merged.get(view.itemId);
		if (!existing) {
			merged.set(view.itemId, view);
			continue;
		}

		merged.set(view.itemId, {
			...existing,
			requiredQuantity: existing.requiredQuantity + view.requiredQuantity,
		});
	}

	return Array.from(merged.values());
};

export const readOutputTargetLimits = ({
	config,
	ignoredBoardItemInstanceIds,
	output,
	save,
}: readOutputTargetLimits.Props): ItemTargetLimit[] => {
	if (!output) return [];

	return mergeLimits(
		output.flatMap((outputEntry) => {
			if (outputEntry.type !== "guaranteed") return [];

			return readItemTargetLimits({
				config,
				ignoredBoardItemInstanceIds,
				itemId: outputEntry.itemId,
				requiredQuantity: readOutputQuantityMaximum(outputEntry.quantity),
				save,
			});
		}),
	);
};
