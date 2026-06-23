import { Effect } from "effect";
import { match } from "ts-pattern";
import { countPassiveItemQuantityFx } from "~/v0/game/requirements/countPassiveItemQuantityFx";
import { checkProximityRequirementFx } from "~/v0/game/requirements/checkProximityRequirementFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameRequirement } from "~/v0/game/requirements/GameRequirement";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import {
	type GameItemQuantityIndex,
	readGameItemQuantity,
} from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace checkGameRequirementsFx {
	export interface Props {
		save: GameSave;
		requirements: readonly GameRequirement[];
		storedItems?: GameItemQuantityIndex;
		targetItemInstanceId: string;
	}
}

export const checkGameRequirementsFx = Effect.fn("checkGameRequirementsFx")(function* ({
	save,
	requirements,
	storedItems,
	targetItemInstanceId,
}: checkGameRequirementsFx.Props) {
	for (const requirement of requirements) {
		yield* match(requirement)
			.with(
				{
					type: "passive",
				},
				(passiveRequirement) =>
					Effect.gen(function* () {
						const availableQuantity = yield* countPassiveItemQuantityFx({
							itemId: passiveRequirement.itemId,
							save,
							scope: passiveRequirement.scope,
						});
						if (availableQuantity < passiveRequirement.quantity) {
							return yield* Effect.fail(
								GameEngineError.actionRejected(
									"missing_requirement",
									`Missing passive requirement "${passiveRequirement.itemId}" (${availableQuantity}/${passiveRequirement.quantity}).`,
								),
							);
						}
					}),
			)
			.with(
				{
					type: "stored",
				},
				(storedRequirement) =>
					Effect.gen(function* () {
						if (!storedItems) {
							return yield* Effect.fail(
								GameEngineError.actionRejected(
									"unsupported_requirement",
									`Stored requirement "${storedRequirement.itemId}" needs target save storage.`,
								),
							);
						}

						const availableQuantity = readGameItemQuantity({
							itemId: storedRequirement.itemId,
							quantities: storedItems,
						});
						if (availableQuantity < storedRequirement.quantity) {
							return yield* Effect.fail(
								GameEngineError.actionRejected(
									"missing_requirement",
									`Missing stored requirement "${storedRequirement.itemId}" (${availableQuantity}/${storedRequirement.quantity}).`,
								),
							);
						}
					}),
			)
			.with(
				{
					type: "proximity",
				},
				(proximityRequirement) =>
					checkProximityRequirementFx({
						distance: proximityRequirement.distance,
						itemIds: proximityRequirement.itemIds,
						save,
						targetItemInstanceId,
					}),
			)
			.exhaustive();
	}
});
