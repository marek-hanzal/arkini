import { match } from "ts-pattern";
import type { GameAction } from "~/action/GameActionSchema";
import type { GameActionItemRef } from "~/action/GameActionItemRefSchema";
import type { ItemToBoardItemInteractionPlan } from "~/play/interaction/ItemToBoardItemInteractionPlan";

export namespace createGameActionFromItemToBoardItemInteractionPlan {
	export interface Props {
		plan: ItemToBoardItemInteractionPlan;
		sourceRef: GameActionItemRef;
		targetItemInstanceId: string;
	}
}

export const createGameActionFromItemToBoardItemInteractionPlan = ({
	plan,
	sourceRef,
	targetItemInstanceId,
}: createGameActionFromItemToBoardItemInteractionPlan.Props): GameAction | undefined =>
	match(plan)
		.with(
			{
				type: "merge",
			},
			() => ({
				sourceRef,
				targetItemInstanceId,
				type: "item.merge" as const,
			}),
		)
		.with(
			{
				type: "stack",
			},
			() => ({
				sourceRef,
				targetItemInstanceId,
				type: "item.stack" as const,
			}),
		)
		.with(
			{
				type: "craft-input",
			},
			() => ({
				inputRef: sourceRef,
				targetItemInstanceId,
				type: "craft.input.store" as const,
			}),
		)
		.with(
			{
				type: "producer-input",
			},
			({ lineId }) => ({
				inputRef: sourceRef,
				itemInstanceId: targetItemInstanceId,
				lineId,
				type: "producer.input.store" as const,
			}),
		)
		.with(
			{
				type: "stash-input",
			},
			() => ({
				inputRefs: [
					sourceRef,
				],
				stashItemInstanceId: targetItemInstanceId,
				type: "stash.open" as const,
			}),
		)
		.with(
			{
				type: "tile-remove",
			},
			() => ({
				targetItemInstanceId,
				toolRef: sourceRef,
				type: "tile.remove" as const,
			}),
		)
		.with(
			{
				type: "reject",
			},
			() => undefined,
		)
		.with(
			{
				type: "swap",
			},
			() => undefined,
		)
		.exhaustive();
