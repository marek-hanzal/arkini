import { useCallback, useEffect, useMemo } from "react";
import { match } from "ts-pattern";

import { TileActor } from "~/ui/tile/TileActor";
import { TileActorRetentionContext } from "~/ui/tile/TileActorRetentionContext";
import { useRetainedTileActors } from "~/ui/tile/useRetainedTileActors";
import { useTileActorLayerSystem } from "~/ui/tile/useTileActorLayerSystem";
import { useTileMotionCues } from "~/ui/tile/useTileMotionCues";

const interactionActorIds = (
	active: ReturnType<typeof useTileActorLayerSystem>["active"],
): ReadonlySet<string> =>
	match(active)
		.with(null, () => new Set<string>())
		.with(
			{
				phase: "pressed",
			},
			({ source }) =>
				new Set([
					source.id,
				]),
		)
		.with(
			{
				phase: "dragging",
			},
			({ source, target }) => {
				const ids = new Set([
					source.id,
				]);
				if (target?.kind === "slot" && target.occupant !== null)
					ids.add(target.occupant.id);
				return ids;
			},
		)
		.with(
			{
				phase: "awaiting-outcome",
			},
			({ source, target }) => {
				const ids = new Set([
					source.id,
				]);
				if (target.kind === "slot" && target.occupant !== null) ids.add(target.occupant.id);
				return ids;
			},
		)
		.with(
			{
				phase: "settling",
			},
			({ settlement }) => new Set(settlement.pendingActorIds),
		)
		.exhaustive();

/** Renders one stable Motion actor per live or explicitly retained presentation identity. */
export const TileActorLayer = () => {
	const { active, registerActorLayer, resetInteraction, clearNeighbourField } =
		useTileActorLayerSystem();
	const resetScene = useCallback(() => {
		resetInteraction();
		clearNeighbourField();
	}, [
		clearNeighbourField,
		resetInteraction,
	]);
	const motionCues = useTileMotionCues({
		onSceneReset: resetScene,
	});
	const liveItems = motionCues.liveItems;
	useEffect(() => {
		const protectedIds = interactionActorIds(active);
		for (const [itemId, cue] of motionCues.cues) {
			if (
				(cue.kind === "exit" ||
					cue.kind === "consume-exit" ||
					cue.kind === "deplete-exit" ||
					cue.kind === "expiry") &&
				protectedIds.has(itemId)
			) {
				resetScene();
				return;
			}
		}
	}, [
		active,
		motionCues.cues,
		resetScene,
	]);
	const retention = useRetainedTileActors({
		active,
		liveItems,
	});
	const actors = useMemo(() => {
		const byId = new Map<
			string,
			{
				readonly item: (typeof liveItems)[number];
				readonly live: boolean;
			}
		>();
		for (const item of motionCues.retainedItems)
			byId.set(item.id, {
				item,
				live: false,
			});
		for (const item of retention.retainedItems)
			byId.set(item.id, {
				item,
				live: false,
			});
		for (const item of liveItems)
			byId.set(item.id, {
				item,
				live: true,
			});
		return [
			...byId.values(),
		];
	}, [
		liveItems,
		motionCues.retainedItems,
		retention.retainedItems,
	]);

	return (
		<div
			ref={registerActorLayer}
			className="pointer-events-none absolute inset-0 z-10 overflow-visible"
			data-ui="TileActorLayer"
		>
			<TileActorRetentionContext.Provider value={retention.retainActorIds}>
				{actors.map(({ item, live }) => (
					<TileActor
						key={item.id}
						item={item}
						live={live}
						cue={motionCues.cues.get(item.id) ?? null}
						morphPreviousItem={motionCues.morphPreviousItems.get(item.id)?.item ?? null}
						onCueStart={motionCues.start}
						onCueContact={motionCues.contact}
						onCueComplete={motionCues.complete}
					/>
				))}
			</TileActorRetentionContext.Provider>
		</div>
	);
};
