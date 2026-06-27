import { Effect } from "effect";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameRequirement } from "~/v0/game/requirements/GameRequirement";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { type GameItemQuantityIndex } from "~/v0/game/quantity/GameItemQuantityIndex";
import { readWorldRequirementFactsFx } from "~/v0/game/world/readWorldRequirementFactsFx";
import type { WorldRequirementFacts } from "~/v0/game/world/WorldRequirementFacts";

export namespace checkGameRequirementsFx {
	export interface Props {
		save: GameSave;
		requirements: readonly GameRequirement[];
		storedItems?: GameItemQuantityIndex;
		targetItemInstanceId: string;
	}
}

const readRequirementItemLabel = (fact: WorldRequirementFacts) => {
	const requirement = fact.requirement;
	if (requirement.type === "proximity") return requirement.itemIds.join(" or ");
	return requirement.itemId;
};

const failRequirementFact = (fact: WorldRequirementFacts) => {
	const requirement = fact.requirement;
	if (fact.status === "unsupported") {
		return GameEngineError.actionRejected(
			"unsupported_requirement",
			requirement.type === "proximity"
				? "Proximity requirement needs a board target item."
				: `Stored requirement "${readRequirementItemLabel(fact)}" needs target save storage.`,
		);
	}

	if (requirement.type === "proximity") {
		return GameEngineError.actionRejected(
			"missing_requirement",
			`Missing nearby requirement (${requirement.itemIds.join(" or ")}) within distance ${requirement.distance}.`,
		);
	}

	return GameEngineError.actionRejected(
		"missing_requirement",
		`Missing ${requirement.type} requirement "${requirement.itemId}" (${fact.availableQuantity ?? 0}/${requirement.quantity}).`,
	);
};

export const checkGameRequirementsFx = Effect.fn("checkGameRequirementsFx")(function* ({
	save,
	requirements,
	storedItems,
	targetItemInstanceId,
}: checkGameRequirementsFx.Props) {
	const facts = yield* readWorldRequirementFactsFx({
		requirements,
		save,
		storedItems,
		targetItemInstanceId,
	});

	const failedFact = facts.find((fact) => fact.status !== "ok");
	if (failedFact) {
		return yield* Effect.fail(failRequirementFact(failedFact));
	}
});
