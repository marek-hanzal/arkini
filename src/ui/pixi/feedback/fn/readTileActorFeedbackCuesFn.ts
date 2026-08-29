import { match, P } from "ts-pattern";

import type { GameTransition } from "~/renderer/game/session/GameSession";
import type { TileActorFeedbackCue } from "~/ui/pixi/feedback/TileActorFeedbackCue";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { SourceActionSchema } from "~/engine/merge/schema/SourceActionSchema";
import { TargetEffectSchema } from "~/engine/merge/schema/TargetEffectSchema";

/**
 * Compiles exact committed facts into actor-local feedback without leaking choreography into the
 * engine event vocabulary.
 */
export const readTileActorFeedbackCuesFn = (transition: GameTransition): TileActorFeedbackCue[] => {
	const depletedActorIds = new Set(
		transition.events.flatMap((event) =>
			event.type === GameEventEnumSchema.enum.ItemDepleted
				? [
						event.itemId,
					]
				: [],
		),
	);
	return transition.events.flatMap((event, eventIndex): TileActorFeedbackCue[] =>
		match(event)
			.with(
				{
					type: P.union(
						GameEventEnumSchema.enum.ItemChargeSpent,
						GameEventEnumSchema.enum.ItemDepleted,
					),
				},
				(spent) => [
					{
						actorId: spent.itemId,
						key: `${transition.sequence}:${eventIndex}:resource-spent`,
						kind: "resource-spent",
					} satisfies TileActorFeedbackCue,
				],
			)
			.with(
				{
					type: GameEventEnumSchema.enum.ItemConsumed,
				},
				(consumed) => [
					{
						actorId: consumed.sourceItemId,
						key: `${transition.sequence}:${eventIndex}:consume-source`,
						kind: "consume-source",
					} satisfies TileActorFeedbackCue,
					{
						actorId: consumed.sourceLocation.ownerItemId,
						key: `${transition.sequence}:${eventIndex}:consume`,
						kind: "consume",
					} satisfies TileActorFeedbackCue,
				],
			)
			.with(
				{
					type: GameEventEnumSchema.enum.ItemInputStored,
				},
				(stored) =>
					[
						{
							actorId: stored.sourceItemId,
							key: `${transition.sequence}:${eventIndex}:consume-source`,
							kind: "consume-source",
						},
						{
							actorId: stored.ownerItemId,
							key: `${transition.sequence}:${eventIndex}:consume`,
							kind: "consume",
						},
					] satisfies TileActorFeedbackCue[],
			)
			.with(
				{
					type: GameEventEnumSchema.enum.ItemMerged,
				},
				(merged) => {
					const cues: TileActorFeedbackCue[] =
						merged.action === SourceActionSchema.enum.Consume
							? [
									{
										actorId: merged.sourceItemId,
										key: `${transition.sequence}:${eventIndex}:consume-source`,
										kind: "consume-source",
									},
								]
							: [];
					const targetCue = match({
						action: merged.action,
						effect: merged.effect,
					})
						.with(
							{
								effect: TargetEffectSchema.enum.Replace,
							},
							() =>
								({
									actorId: merged.targetItemId,
									key: `${transition.sequence}:${eventIndex}:replacement`,
									kind: "replacement",
								}) satisfies TileActorFeedbackCue,
						)
						.with(
							{
								action: SourceActionSchema.enum.Consume,
							},
							() =>
								({
									actorId: merged.targetItemId,
									key: `${transition.sequence}:${eventIndex}:consume`,
									kind: "consume",
								}) satisfies TileActorFeedbackCue,
						)
						.with(
							{
								action: SourceActionSchema.enum.Use,
								effect: P.union(
									TargetEffectSchema.enum.Keep,
									TargetEffectSchema.enum.Remove,
								),
							},
							() => null,
						)
						.exhaustive();
					if (targetCue !== null) cues.push(targetCue);
					return cues;
				},
			)
			.with(
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					originItemId: P.when((originItemId) => depletedActorIds.has(originItemId)),
				},
				(spawned) => [
					{
						actorId: spawned.itemId,
						key: `${transition.sequence}:${eventIndex}:replacement`,
						kind: "replacement",
					} satisfies TileActorFeedbackCue,
				],
			)
			.otherwise(() => []),
	);
};
