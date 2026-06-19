import { match } from "ts-pattern";
import type { GameAction } from "~/v0/game/action/GameActionSchema";
import type { GameActionItemRef } from "~/v0/game/action/GameActionItemRefSchema";
import type { ItemToBoardItemInteractionPlan } from "~/v0/play/interaction/ItemToBoardItemInteractionPlan";

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
				type: "stored-requirement",
			},
			() => ({
				inputRef: sourceRef,
				targetItemInstanceId,
				type: "stored_requirement.store" as const,
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
			({ productId }) => ({
				inputRef: sourceRef,
				producerItemInstanceId: targetItemInstanceId,
				productId,
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
