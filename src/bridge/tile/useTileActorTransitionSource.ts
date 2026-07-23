import { useMemo } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { isSameTileLocation } from "~/bridge/tile/isSameTileLocation";
import { readTileActorTransitionFx } from "~/bridge/tile/readTileActorTransitionFx";

export interface TileActorTransitionSource {
	readonly initial: readTileActorTransitionFx.Result;
	readonly claimCurrent: () => readTileActorTransitionFx.Result;
	readonly subscribe: (
		listener: (transition: readTileActorTransitionFx.Result) => void | PromiseLike<void>,
	) => () => void;
}

const isSamePrimaryAction = (
	left: TileActorItem["primaryAction"],
	right: TileActorItem["primaryAction"],
) =>
	left.kind === right.kind &&
	(left.kind !== "start-default-line" ||
		(right.kind === "start-default-line" && left.lineId === right.lineId));

const isSameTileActorItem = (left: TileActorItem, right: TileActorItem) =>
	left.id === right.id &&
	left.revision === right.revision &&
	left.itemId === right.itemId &&
	left.title === right.title &&
	left.quantity === right.quantity &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl &&
	left.jobStatus === right.jobStatus &&
	left.running === right.running &&
	isSameTileLocation(left.location, right.location) &&
	isSamePrimaryAction(left.primaryAction, right.primaryAction);

const stabilizeItems = (
	previous: ReadonlyArray<TileActorItem> | null,
	projected: ReadonlyArray<TileActorItem>,
): ReadonlyArray<TileActorItem> => {
	if (previous === null) return projected;
	if (previous.length === 0) return projected.length === 0 ? previous : projected;
	const previousById = new Map(
		previous.map(
			(item) =>
				[
					item.id,
					item,
				] as const,
		),
	);
	let changed = previous.length !== projected.length;
	const stable = projected.map((item, index) => {
		const candidate = previousById.get(item.id);
		if (candidate === undefined || !isSameTileActorItem(candidate, item)) {
			changed = true;
			return item;
		}
		if (previous[index] !== candidate) changed = true;
		return candidate;
	});
	return changed ? stable : previous;
};

/** Exposes one exact current tile transition plus its ordered committed tail. */
export const useTileActorTransitionSource = (): TileActorTransitionSource => {
	const game = useGameEngine();

	return useMemo(() => {
		const read = (transition: ReturnType<typeof game.getTransitionSnapshot>) =>
			game.readOrThrow(
				readTileActorTransitionFx({
					game,
					transition,
				}),
			);
		const current = read(game.getTransitionSnapshot());
		let latest: readTileActorTransitionFx.Result = {
			...current,
			previousItems: null,
			events: [],
		};
		let deliveredSequence = current.sequence - 1;

		const project = (transition: ReturnType<typeof game.getTransitionSnapshot>) => {
			if (transition.sequence <= deliveredSequence) return latest;
			const projected = read(transition);
			const deliverEvents = game.claimTilePresentationTransition(transition.sequence);
			const previousItems = deliverEvents
				? transition.sequence === latest.sequence + 1
					? latest.liveItems
					: projected.previousItems === null
						? null
						: stabilizeItems(latest.liveItems, projected.previousItems)
				: null;
			const liveItems = stabilizeItems(latest.liveItems, projected.liveItems);
			deliveredSequence = transition.sequence;
			latest = {
				...projected,
				previousItems,
				liveItems,
				events: deliverEvents ? projected.events : [],
			};
			return latest;
		};

		return {
			initial: latest,
			claimCurrent: () => project(game.getTransitionSnapshot()),
			subscribe: (listener) =>
				game.subscribeTransitions((transition) => listener(project(transition))),
		};
	}, [
		game,
	]);
};
