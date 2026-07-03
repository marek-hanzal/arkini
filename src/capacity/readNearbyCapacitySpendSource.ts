import type { BoardCell } from "~/board/logic/BoardCell";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readChebyshevDistance } from "~/effects/readChebyshevDistance";
import { readGameEffectSourceCell } from "~/effects/readGameEffectSourceCell";
import { doesResolvedDomainSelectorMatchId } from "~/selector/doesResolvedDomainSelectorMatchId";
import { readItemCapacityState } from "~/capacity/readItemCapacityState";

type LineEffect = NonNullable<GameLineDefinition["effects"]>[number];
export type NearbyCapacitySpendEffect = Extract<
	LineEffect,
	{
		kind: "nearby.capacity.spend";
	}
>;

export interface NearbyCapacitySpendSource {
	cell: BoardCell;
	distance: number;
	itemId: string;
	itemInstanceId: string;
	max: number;
	remaining: number;
}

export const readNearbyCapacitySpendSource = ({
	config,
	effect,
	itemInstanceId,
	save,
}: {
	config: GameConfig;
	effect: NearbyCapacitySpendEffect;
	itemInstanceId: string;
	save: GameSave;
}): NearbyCapacitySpendSource | undefined => {
	const targetCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: itemInstanceId,
	});
	if (!targetCell) return undefined;

	return Object.values(save.board.items)
		.flatMap((item) => {
			if (
				!doesResolvedDomainSelectorMatchId({
					entityId: item.itemId,
					selector: effect.items as Parameters<
						typeof doesResolvedDomainSelectorMatchId
					>[0]["selector"],
				})
			) {
				return [];
			}
			const capacity = readItemCapacityState({
				config,
				itemInstanceId: item.id,
				save,
			});
			if (!capacity || capacity.remaining < effect.amount) return [];

			const cell = readGameEffectSourceCell({
				save,
				sourceItemInstanceId: item.id,
			});
			if (!cell) return [];

			const distance = readChebyshevDistance(cell, targetCell);
			if (distance > effect.radius) return [];

			return [
				{
					cell,
					distance,
					itemId: item.itemId,
					itemInstanceId: item.id,
					max: capacity.max,
					remaining: capacity.remaining,
				},
			];
		})
		.sort(
			(left, right) =>
				left.distance - right.distance ||
				left.itemInstanceId.localeCompare(right.itemInstanceId),
		)[0];
};
