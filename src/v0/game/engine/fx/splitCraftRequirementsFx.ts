import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameRequirement } from "~/v0/game/engine/model/GameRequirement";

export namespace splitCraftRequirementsFx {
	export interface Props {
		requirements: readonly GameRequirement[];
	}
}

export const splitCraftRequirementsFx = Effect.fn("splitCraftRequirementsFx")(function* ({
	requirements,
}: splitCraftRequirementsFx.Props) {
	const passiveRequirements: GameRequirement[] = [];
	const storedRequirements: GameRequirement[] = [];

	for (const requirement of requirements) {
		yield* match(requirement)
			.with(
				{
					type: "passive",
				},
				(passiveRequirement) => {
					passiveRequirements.push(passiveRequirement);
					return Effect.void;
				},
			)
			.with(
				{
					type: "stored",
				},
				(storedRequirement) => {
					storedRequirements.push(storedRequirement);
					return Effect.void;
				},
			)
			.exhaustive();
	}

	return {
		passiveRequirements,
		storedRequirements,
	};
});
