import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readChebyshevDistance } from "~/effects/readChebyshevDistance";
import { readGameEffectSourceCell } from "~/effects/readGameEffectSourceCell";
import { doesResolvedDomainSelectorMatchId } from "~/selector/doesResolvedDomainSelectorMatchId";

type LineOutput = NonNullable<GameLineDefinition["output"]>[number];
type NonWeightedLineOutput = Exclude<
	LineOutput,
	{
		type: "weighted";
	}
>;
type DropEffect = NonNullable<NonWeightedLineOutput["effects"]>[number];
type LineEffect = NonNullable<GameLineDefinition["effects"]>[number];
type RuntimeLineEffect = DropEffect | LineEffect;

export type RuntimeItemSelector = Extract<
	RuntimeLineEffect,
	{
		kind: "nearby.capacity.spend" | "nearby.duration.multiply" | "nearby.require";
	}
>["items"];

export const readNearbyLineEffectMatches = ({
	items,
	radius,
	save,
	targetCell,
}: {
	items: RuntimeItemSelector;
	radius: number;
	save: GameSave;
	targetCell?: BoardCell;
}) => {
	if (!targetCell) return [];

	return Object.values(save.board.items)
		.flatMap((item) => {
			const cell = readGameEffectSourceCell({
				save,
				sourceItemInstanceId: item.id,
			});
			if (!cell) return [];
			if (
				!doesResolvedDomainSelectorMatchId({
					entityId: item.itemId,
					selector: items as Parameters<
						typeof doesResolvedDomainSelectorMatchId
					>[0]["selector"],
				})
			) {
				return [];
			}
			const distance = readChebyshevDistance(cell, targetCell);
			if (distance > radius) return [];
			return [
				{
					distance,
					item,
				},
			];
		})
		.sort(
			(left, right) =>
				left.distance - right.distance || left.item.id.localeCompare(right.item.id),
		);
};

export const readNearbyDurationMultiplier = ({
	bands,
	distance,
}: {
	bands: Extract<
		DropEffect,
		{
			kind: "nearby.duration.multiply";
		}
	>["bands"];
	distance: number;
}) =>
	bands.find(
		(band) =>
			distance >= band.minDistance &&
			(band.maxDistance === undefined || distance <= band.maxDistance),
	)?.multiplier;
