import type { ActivationHindranceView } from "~/v0/board/view/ActivationHindranceViewSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameHindrance } from "~/v0/game/hindrances/GameHindrance";
import {
	readGameHindranceDurationMultiplier,
	readPassiveHindranceItemQuantity,
} from "~/v0/game/hindrances/readGameHindranceDurationMultiplier";
import { readProximityRequirementMatches } from "~/v0/game/requirements/readProximityRequirementMatch";

export namespace readRuntimeActivationHindranceViewsFromGameSave {
	export interface Props {
		hindrances: readonly GameHindrance[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

const readRuntimePassiveHindranceViewFromGameSave = ({
	hindrance,
	save,
	targetItemInstanceId,
}: {
	hindrance: Extract<
		GameHindrance,
		{
			type: "passive";
		}
	>;
	save: GameSave;
	targetItemInstanceId: string;
}): ActivationHindranceView | undefined => {
	const activeQuantity = readPassiveHindranceItemQuantity({
		itemId: hindrance.itemId,
		save,
		scope: hindrance.scope,
	});
	const activeStacks = Math.floor(activeQuantity / hindrance.quantity);
	if (activeStacks <= 0) return undefined;
	const durationMultiplier = readGameHindranceDurationMultiplier({
		hindrance,
		save,
		targetItemInstanceId,
	});
	if (durationMultiplier === undefined) return undefined;

	return {
		activeQuantity,
		activeStacks,
		durationMultiplier,
		itemId: hindrance.itemId as ItemId,
		quantity: hindrance.quantity,
		type: "passive",
	};
};

const readRuntimeProximityHindranceViewFromGameSave = ({
	hindrance,
	save,
	targetItemInstanceId,
}: {
	hindrance: Extract<
		GameHindrance,
		{
			type: "proximity";
		}
	>;
	save: GameSave;
	targetItemInstanceId: string;
}): ActivationHindranceView | undefined => {
	const matches = readProximityRequirementMatches({
		itemIds: hindrance.itemIds,
		save,
		targetItemInstanceId,
	}).filter((match) => match.distance <= hindrance.distance);
	if (matches.length === 0) return undefined;
	const durationMultiplier = readGameHindranceDurationMultiplier({
		hindrance,
		save,
		targetItemInstanceId,
	});
	if (durationMultiplier === undefined) return undefined;

	return {
		distance: hindrance.distance,
		durationMultiplier,
		itemIds: hindrance.itemIds as ItemId[],
		matches: matches.map((match) => ({
			distance: match.distance,
			itemId: match.item.itemId as ItemId,
		})),
		type: "proximity",
	};
};

export const readRuntimeActivationHindranceViewsFromGameSave = ({
	hindrances,
	save,
	targetItemInstanceId,
}: readRuntimeActivationHindranceViewsFromGameSave.Props): ActivationHindranceView[] =>
	hindrances.flatMap((hindrance) => {
		const view =
			hindrance.type === "passive"
				? readRuntimePassiveHindranceViewFromGameSave({
						hindrance,
						save,
						targetItemInstanceId,
					})
				: readRuntimeProximityHindranceViewFromGameSave({
						hindrance,
						save,
						targetItemInstanceId,
					});

		return view === undefined
			? []
			: [
					view,
				];
	});
