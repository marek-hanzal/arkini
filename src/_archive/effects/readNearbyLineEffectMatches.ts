import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readChebyshevDistance } from "~/effects/readChebyshevDistance";
import { doesNearbyDistanceMatch, readNearbyDistanceBucket } from "~/effects/readNearbyDistance";
import { readGameEffectSourceCell } from "~/effects/readGameEffectSourceCell";
import type { DropEffect, RuntimeItemSelector } from "~/effects/RuntimeLineEffectTypes";
import { doesResolvedDomainSelectorMatchId } from "~/selector/doesResolvedDomainSelectorMatchId";

export const readNearbyLineEffectMatches = ({
	items,
	nearbyDistance,
	save,
	targetCell,
}: {
	items: RuntimeItemSelector;
	nearbyDistance: Parameters<typeof doesNearbyDistanceMatch>[0]["nearbyDistance"];
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
			if (
				!doesNearbyDistanceMatch({
					distance,
					nearbyDistance,
				})
			)
				return [];
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
}) => {
	const bucket = readNearbyDistanceBucket(distance);
	return bands.find((band) => band.distance === bucket)?.multiplier;
};
