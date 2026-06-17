import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { nextGameRandom } from "~/v0/game/engine/logic/nextGameRandom";

type LootOutput = GameConfig["lootTables"][string]["output"][number];
type Quantity = NonNullable<
	Exclude<
		LootOutput,
		{
			type: "weighted";
		}
	>["quantity"]
>;

export interface GameQuantityRollResult {
	quantity: number;
	seed: number;
}

export const rollGameQuantity = (
	quantity: Quantity | undefined,
	seed: number,
): GameQuantityRollResult => {
	if (!quantity) {
		return {
			quantity: 1,
			seed,
		};
	}

	if (typeof quantity === "number") {
		return {
			quantity,
			seed,
		};
	}

	const random = nextGameRandom(seed);
	const width = quantity.max - quantity.min + 1;

	return {
		quantity: quantity.min + Math.floor(random.value * width),
		seed: random.seed,
	};
};
