import { useCallback, useRef, useState } from "react";
import { match } from "ts-pattern";

import type { useDropItem } from "~/bridge/tile/useDropItem";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import type {
	TileInteractionState,
	TileSettlementState,
	TileSettlingInteraction,
} from "~/ui/tile/TileInteractionState";

const sameTarget = (left: TileDropTarget | null, right: TileDropTarget | null) => {
	if (left === null || right === null) return left === right;
	if (left.kind !== right.kind) return false;
	if (left.kind === "outside" || right.kind === "outside") return true;
	if (left.surface.id !== right.surface.id) return false;
	if (left.kind === "surface" || right.kind === "surface") return true;
	return (
		left.slot.id === right.slot.id &&
		left.occupant?.id === right.occupant?.id &&
		left.occupant?.revision === right.occupant?.revision
	);
};

const settlementForOutcome = (
	source: TileDragSource,
	outcome: useDropItem.Result | null,
): TileSettlementState =>
	match(outcome)
		.with(null, () => ({
			kind: "failed" as const,
			feedback: "rejected" as const,
			outcome: null,
			pendingActorIds: [
				source.id,
			],
		}))
		.with(
			{
				kind: "reject",
			},
			(rejected) => ({
				kind: "reject" as const,
				feedback: "rejected" as const,
				outcome: rejected,
				pendingActorIds: [
					source.id,
				],
			}),
		)
		.with(
			{
				kind: "ignored",
			},
			(ignored) => ({
				kind: "ignored" as const,
				feedback: "ignored" as const,
				outcome: ignored,
				pendingActorIds: [
					source.id,
				],
			}),
		)
		.with(
			{
				kind: "move",
			},
			(moved) => ({
				kind: "move" as const,
				feedback: "accepted" as const,
				outcome: moved,
				location: moved.location,
				pendingActorIds: [
					source.id,
				],
			}),
		)
		.with(
			{
				kind: "swap",
			},
			(swapped) => ({
				kind: "swap" as const,
				feedback: "accepted" as const,
				outcome: swapped,
				sourceLocation: swapped.source.location,
				pendingActorIds: [
					source.id,
					swapped.target.itemId,
				],
			}),
		)
		.with(
			{
				kind: "merge",
			},
			(merged) => ({
				kind: "merge" as const,
				feedback: "accepted" as const,
				outcome: merged,
				stage: "approach" as const,
				pendingActorIds: [
					source.id,
				],
			}),
		)
		.exhaustive();

const removePendingActor = (
	current: TileSettlingInteraction,
	itemId: string,
): TileSettlingInteraction | null => {
	const pendingActorIds = current.settlement.pendingActorIds.filter(
		(pendingItemId) => pendingItemId !== itemId,
	);
	if (pendingActorIds.length === 0) return null;
	return {
		...current,
		settlement: {
			...current.settlement,
			pendingActorIds,
		},
	};
};

/** Owns valid transitions for the one Canvas-local tile interaction generation. */
export const useTileInteractionController = ({
	resolveTarget,
}: {
	readonly resolveTarget: (x: number, y: number) => TileDropTarget;
}) => {
	const nextGeneration = useRef(0);
	const activeRef = useRef<TileInteractionState | null>(null);
	const [active, setActive] = useState<TileInteractionState | null>(null);

	const publishActive = useCallback((next: TileInteractionState | null) => {
		activeRef.current = next;
		setActive(next);
	}, []);

	const press = useCallback(
		(source: TileDragSource) =>
			match(activeRef.current)
				.with(
					null,
					{
						phase: "settling",
					},
					() => {
						publishActive({
							source,
							generation: ++nextGeneration.current,
							phase: "pressed",
						});
						return true;
					},
				)
				.with(
					{
						phase: "pressed",
					},
					{
						phase: "dragging",
					},
					{
						phase: "awaiting-outcome",
					},
					() => false,
				)
				.exhaustive(),
		[
			publishActive,
		],
	);

	const startDrag = useCallback(
		(source: TileDragSource) => {
			const current = activeRef.current;
			if (current?.source.id !== source.id) return;
			match(current)
				.with(
					{
						phase: "pressed",
					},
					(pressed) => {
						publishActive({
							...pressed,
							phase: "dragging",
							target: null,
						});
					},
				)
				.with(
					{
						phase: "dragging",
					},
					{
						phase: "awaiting-outcome",
					},
					{
						phase: "settling",
					},
					() => undefined,
				)
				.exhaustive();
		},
		[
			publishActive,
		],
	);

	const moveDrag = useCallback(
		(source: TileDragSource, x: number, y: number): TileDropTarget | null => {
			const current = activeRef.current;
			if (current?.source.id !== source.id) return null;
			return match(current)
				.with(
					{
						phase: "dragging",
					},
					(dragging) => {
						const target = resolveTarget(x, y);
						if (!sameTarget(dragging.target, target)) {
							publishActive({
								...dragging,
								target,
							});
						}
						return target;
					},
				)
				.with(
					{
						phase: "pressed",
					},
					{
						phase: "awaiting-outcome",
					},
					{
						phase: "settling",
					},
					() => null,
				)
				.exhaustive();
		},
		[
			publishActive,
			resolveTarget,
		],
	);

	const release = useCallback(
		(itemId: string) => {
			const current = activeRef.current;
			if (current?.source.id !== itemId) return null;
			return match(current)
				.with(
					{
						phase: "dragging",
					},
					(dragging) => {
						const target = dragging.target ?? {
							kind: "outside" as const,
						};
						const awaiting = {
							...dragging,
							phase: "awaiting-outcome" as const,
							target,
						};
						publishActive(awaiting);
						return {
							source: awaiting.source,
							generation: awaiting.generation,
							target: awaiting.target,
						};
					},
				)
				.with(
					{
						phase: "pressed",
					},
					{
						phase: "awaiting-outcome",
					},
					{
						phase: "settling",
					},
					() => null,
				)
				.exhaustive();
		},
		[
			publishActive,
		],
	);

	const settle = useCallback(
		(source: TileDragSource, generation: number, outcome: useDropItem.Result | null) => {
			const current = activeRef.current;
			if (current?.source.id !== source.id || current.generation !== generation) return;
			match(current)
				.with(
					{
						phase: "awaiting-outcome",
					},
					(awaiting) => {
						publishActive({
							source: awaiting.source,
							generation: awaiting.generation,
							phase: "settling",
							settlement: settlementForOutcome(source, outcome),
						});
					},
				)
				.with(
					{
						phase: "pressed",
					},
					{
						phase: "dragging",
					},
					{
						phase: "settling",
					},
					() => undefined,
				)
				.exhaustive();
		},
		[
			publishActive,
		],
	);

	const complete = useCallback(
		(itemId: string, generation: number) => {
			const current = activeRef.current;
			if (current?.generation !== generation) return;
			match(current)
				.with(
					{
						phase: "settling",
					},
					(settling) => {
						if (!settling.settlement.pendingActorIds.includes(itemId)) return;
						const next = match(settling.settlement)
							.with(
								{
									kind: "merge",
									stage: "approach",
								},
								(merge) =>
									itemId === settling.source.id
										? {
												...settling,
												settlement: {
													...merge,
													stage: "resolve" as const,
													pendingActorIds: [
														merge.outcome.source.itemId,
														merge.outcome.target.itemId,
													],
												},
											}
										: settling,
							)
							.with(
								{
									kind: "merge",
									stage: "resolve",
								},
								{
									kind: "failed",
								},
								{
									kind: "reject",
								},
								{
									kind: "ignored",
								},
								{
									kind: "move",
								},
								{
									kind: "swap",
								},
								() => removePendingActor(settling, itemId),
							)
							.exhaustive();
						publishActive(next);
					},
				)
				.with(
					{
						phase: "pressed",
					},
					{
						phase: "dragging",
					},
					{
						phase: "awaiting-outcome",
					},
					() => undefined,
				)
				.exhaustive();
		},
		[
			publishActive,
		],
	);

	const cancel = useCallback(
		(itemId: string) => {
			const current = activeRef.current;
			if (current?.source.id !== itemId) return;
			match(current)
				.with(
					{
						phase: "pressed",
					},
					{
						phase: "dragging",
					},
					{
						phase: "awaiting-outcome",
					},
					() => publishActive(null),
				)
				.with(
					{
						phase: "settling",
					},
					() => undefined,
				)
				.exhaustive();
		},
		[
			publishActive,
		],
	);

	return {
		active,
		press,
		startDrag,
		moveDrag,
		release,
		settle,
		complete,
		cancel,
	};
};
