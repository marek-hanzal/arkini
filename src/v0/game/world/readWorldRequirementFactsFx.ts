import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import {
	type GameItemQuantityIndex,
	readGameItemQuantity,
} from "~/v0/game/quantity/GameItemQuantityIndex";
import type { GameRequirement } from "~/v0/game/requirements/GameRequirement";
import { readGameSaveItemQuantityByScope } from "~/v0/game/requirements/readGameSaveItemQuantityByScope";
import { readProximityRequirementMatch } from "~/v0/game/requirements/readProximityRequirementMatch";
import type { WorldRequirementFacts } from "~/v0/game/world/WorldRequirementFacts";

export namespace readWorldRequirementFactsFx {
	export interface Props {
		requirements: readonly GameRequirement[];
		save: GameSave;
		storedItems?: GameItemQuantityIndex;
		targetItemInstanceId?: string;
	}
}

export const readWorldRequirementFactsFx = Effect.fn("readWorldRequirementFactsFx")(function* ({
	requirements,
	save,
	storedItems,
	targetItemInstanceId,
}: readWorldRequirementFactsFx.Props) {
	const facts: WorldRequirementFacts[] = [];

	for (const requirement of requirements) {
		facts.push(
			yield* match(requirement)
				.with(
					{
						type: "passive",
					},
					(passiveRequirement) =>
						Effect.gen(function* () {
							const availableQuantity = readGameSaveItemQuantityByScope({
								itemId: passiveRequirement.itemId,
								save,
								scope: passiveRequirement.scope,
							});

							return {
								availableQuantity,
								requiredQuantity: passiveRequirement.quantity,
								requirement,
								status:
									availableQuantity >= passiveRequirement.quantity
										? "ok"
										: "missing",
							} satisfies WorldRequirementFacts;
						}),
				)
				.with(
					{
						type: "stored",
					},
					(storedRequirement) =>
						Effect.gen(function* () {
							if (!storedItems) {
								return {
									requirement,
									status: "unsupported",
								} satisfies WorldRequirementFacts;
							}

							const availableQuantity = readGameItemQuantity({
								itemId: storedRequirement.itemId,
								quantities: storedItems,
							});

							return {
								availableQuantity,
								requiredQuantity: storedRequirement.quantity,
								requirement,
								status:
									availableQuantity >= storedRequirement.quantity
										? "ok"
										: "missing",
							} satisfies WorldRequirementFacts;
						}),
				)
				.with(
					{
						type: "proximity",
					},
					(proximityRequirement) =>
						Effect.gen(function* () {
							if (!targetItemInstanceId || !save.board.items[targetItemInstanceId]) {
								return {
									requirement,
									status: "unsupported",
								} satisfies WorldRequirementFacts;
							}

							const proximityMatch = readProximityRequirementMatch({
								itemIds: proximityRequirement.itemIds,
								save,
								targetItemInstanceId,
							});
							if (!proximityMatch) {
								return {
									requiredDistance: proximityRequirement.distance,
									requirement,
									status: "missing",
								} satisfies WorldRequirementFacts;
							}

							return {
								matchedDistance: proximityMatch.distance,
								matchedItemInstanceId: proximityMatch.item.id,
								requiredDistance: proximityRequirement.distance,
								requirement,
								status:
									proximityMatch.distance <= proximityRequirement.distance
										? "ok"
										: "out_of_range",
							} satisfies WorldRequirementFacts;
						}),
				)
				.exhaustive(),
		);
	}

	return facts;
});
