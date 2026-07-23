import { useDragControls, type PanInfo } from "motion/react";
import { type PointerEventHandler, useCallback, useEffect, useRef } from "react";
import { match } from "ts-pattern";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import { useDropItem } from "~/bridge/tile/useDropItem";
import type { useDropItemPreview } from "~/bridge/tile/useDropItemPreview";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import { useTileActorInteraction } from "~/ui/tile/useTileActorInteraction";
import { useTileActorRetention } from "~/ui/tile/useTileActorRetention";
import { tileLocationForTarget } from "~/ui/tile/tileLocationForTarget";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";
import type { useTileActorPointerMotion } from "~/ui/tile/useTileActorPointerMotion";

const targetForPreview = (
	target: TileDropTarget,
	previewKind: useDropItemPreview.Result["kind"] | null,
) => {
	if (target.kind !== "slot" || target.occupant === null) return null;
	if (previewKind === DropItemResultKindEnumSchema.enum.Merge) {
		return {
			itemId: target.occupant.id,
			feedback: "merge" as const,
		};
	}
	if (previewKind === DropItemResultKindEnumSchema.enum.StoreInput) {
		return {
			itemId: target.occupant.id,
			feedback: "accepted" as const,
		};
	}
	if (previewKind === DropItemResultKindEnumSchema.enum.Reject) {
		return {
			itemId: target.occupant.id,
			feedback: "rejected" as const,
		};
	}
	return null;
};

type TileActorTravelTarget = ReturnType<typeof targetForPreview>;

const sameTravelTarget = (left: TileActorTravelTarget, right: TileActorTravelTarget) =>
	left === null || right === null
		? left === right
		: left.itemId === right.itemId && left.feedback === right.feedback;

const rejectedTarget = (target: TileDropTarget) =>
	target.kind === "slot" && target.occupant !== null
		? {
				itemId: target.occupant.id,
				feedback: "rejected" as const,
			}
		: null;

const targetForOutcome = (target: TileDropTarget, outcome: useDropItem.Result | null) =>
	match(outcome)
		.with(null, () => rejectedTarget(target))
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.StoreInput,
			},
			(stored) => ({
				itemId: stored.owner.itemId,
				feedback: "accepted" as const,
			}),
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Merge,
			},
			(merged) => ({
				itemId: merged.target.itemId,
				feedback: "merge" as const,
			}),
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Reject,
			},
			() => rejectedTarget(target),
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Ignored,
			},
			{
				kind: DropItemResultKindEnumSchema.enum.Move,
			},
			{
				kind: DropItemResultKindEnumSchema.enum.Swap,
			},
			() => null,
		)
		.exhaustive();

/** Owns pointer arbitration, Motion drag controls, command handoff, and failure settlement. */
export const useTileActorDrag = ({
	canonicalSource,
	live,
	terminalCueActive,
	pointer,
}: {
	readonly canonicalSource: TileDragSource;
	readonly live: boolean;
	readonly terminalCueActive: boolean;
	readonly pointer: useTileActorPointerMotion.Control;
}) => {
	const retainActorIds = useTileActorRetention();
	const active = useTileActorInteraction(canonicalSource.id);
	const {
		press,
		startDrag,
		moveDrag,
		release,
		settle,
		cancel,
		setNeighbourTravelTarget,
		setNeighbourSemanticSource,
	} = useTileActorSystem();
	const dropItem = useDropItem();
	const dragControls = useDragControls();
	const dragStarted = useRef(false);
	const pointerOwned = useRef(false);
	const suppressClick = useRef(false);
	const travelTarget = useRef<TileActorTravelTarget>(null);

	const updateNeighbourTravelTarget = useCallback(
		(next: TileActorTravelTarget) => {
			if (sameTravelTarget(travelTarget.current, next)) return;
			travelTarget.current = next;
			setNeighbourTravelTarget(canonicalSource.id, next);
		},
		[
			canonicalSource.id,
			setNeighbourTravelTarget,
		],
	);

	const clearTransientDragMotion = useCallback(() => {
		updateNeighbourTravelTarget(null);
		setNeighbourSemanticSource(canonicalSource.id, null);
	}, [
		canonicalSource.id,
		setNeighbourSemanticSource,
		updateNeighbourTravelTarget,
	]);

	const updateTransientDragMotion = useCallback(
		(info: PanInfo) => {
			pointer.updateResponse(info);
			const movement = moveDrag(canonicalSource, info.point.x, info.point.y);
			updateNeighbourTravelTarget(
				movement === null ? null : targetForPreview(movement.target, movement.previewKind),
			);
		},
		[
			canonicalSource,
			moveDrag,
			pointer,
			updateNeighbourTravelTarget,
		],
	);

	const onPointerDown = useCallback<PointerEventHandler<HTMLSpanElement>>(
		(event) => {
			if (!live || !event.isPrimary || event.button !== 0) return;
			if (!press(canonicalSource)) return;
			pointerOwned.current = true;
			clearTransientDragMotion();
			retainActorIds([
				canonicalSource.id,
			]);
			const bounds = event.currentTarget.getBoundingClientRect();
			pointer.armPickup({
				x: event.clientX - (bounds.left + bounds.width / 2),
				y: event.clientY - (bounds.top + bounds.height / 2),
			});
			dragStarted.current = false;
			suppressClick.current = false;
			dragControls.start(event, {
				distanceThreshold: 6,
			});
		},
		[
			canonicalSource,
			clearTransientDragMotion,
			dragControls,
			live,
			pointer,
			press,
			retainActorIds,
		],
	);

	const onPointerUp = useCallback(() => {
		if (!pointerOwned.current) return;
		if (dragStarted.current) return;
		pointerOwned.current = false;
		dragStarted.current = false;
		pointer.disarmPickup();
		clearTransientDragMotion();
		cancel(canonicalSource.id);
	}, [
		cancel,
		canonicalSource.id,
		clearTransientDragMotion,
		pointer,
	]);

	const onPointerCancel = useCallback(() => {
		if (!pointerOwned.current) return;
		pointerOwned.current = false;
		dragStarted.current = false;
		pointer.cancel();
		clearTransientDragMotion();
		dragControls.cancel();
		cancel(canonicalSource.id);
	}, [
		cancel,
		canonicalSource.id,
		clearTransientDragMotion,
		dragControls,
		pointer,
	]);

	const onDragStart = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			if (!pointerOwned.current) return;
			dragStarted.current = true;
			suppressClick.current = true;
			startDrag(canonicalSource);
			setNeighbourSemanticSource(canonicalSource.id, canonicalSource);
			pointer.startPickup();
			updateTransientDragMotion(info);
		},
		[
			canonicalSource,
			pointer,
			setNeighbourSemanticSource,
			startDrag,
			updateTransientDragMotion,
		],
	);

	const onDrag = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			if (!pointerOwned.current) return;
			updateTransientDragMotion(info);
		},
		[
			updateTransientDragMotion,
		],
	);

	const onDragEnd = useCallback(
		async (_event: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
			if (!pointerOwned.current) return;
			pointerOwned.current = false;
			const released = release(canonicalSource.id);
			if (released === null) {
				dragStarted.current = false;
				pointer.cancel();
				setNeighbourSemanticSource(canonicalSource.id, null);
				updateNeighbourTravelTarget(null);
				return;
			}
			pointer.release(released.generation);
			retainActorIds([
				released.source.id,
				...(released.target.kind === "slot" && released.target.occupant !== null
					? [
							released.target.occupant.id,
						]
					: []),
			]);
			const target = match(released.target)
				.with(
					{
						kind: "slot",
					},
					(slot) => {
						const location = tileLocationForTarget(slot);
						return location === null
							? {
									kind: "unsupported" as const,
								}
							: {
									kind: "slot" as const,
									location,
									occupant:
										slot.occupant === null
											? null
											: {
													itemId: slot.occupant.id,
													revision: slot.occupant.revision,
												},
								};
					},
				)
				.with(
					{
						kind: "surface",
					},
					{
						kind: "outside",
					},
					() => ({
						kind: "unsupported" as const,
					}),
				)
				.exhaustive();
			try {
				const outcome = await dropItem({
					sourceItemId: released.source.id,
					sourceRevision: released.source.revision,
					sourceLocation: released.source.location,
					target,
				});
				setNeighbourSemanticSource(canonicalSource.id, null);
				updateNeighbourTravelTarget(targetForOutcome(released.target, outcome));
				settle(released.source, released.generation, outcome);
			} catch (error) {
				console.error("Tile drop failed.", error);
				setNeighbourSemanticSource(canonicalSource.id, null);
				updateNeighbourTravelTarget(targetForOutcome(released.target, null));
				settle(released.source, released.generation, null);
			} finally {
				dragStarted.current = false;
			}
		},
		[
			canonicalSource.id,
			dropItem,
			pointer,
			release,
			retainActorIds,
			setNeighbourSemanticSource,
			settle,
			updateNeighbourTravelTarget,
		],
	);

	useEffect(() => {
		if (!pointerOwned.current) return;
		if (live && active?.source.id === canonicalSource.id) return;
		pointerOwned.current = false;
		dragStarted.current = false;
		if (terminalCueActive) pointer.handoffToTerminalCue();
		else pointer.cancel();
		clearTransientDragMotion();
		dragControls.cancel();
		cancel(canonicalSource.id);
	}, [
		active,
		cancel,
		canonicalSource.id,
		clearTransientDragMotion,
		dragControls,
		live,
		pointer,
		terminalCueActive,
	]);

	const consumeClickSuppression = useCallback(() => {
		const suppressed = suppressClick.current;
		suppressClick.current = false;
		return suppressed;
	}, []);

	useEffect(
		() => () => {
			pointerOwned.current = false;
			dragStarted.current = false;
			pointer.cancel();
			clearTransientDragMotion();
			dragControls.cancel();
			cancel(canonicalSource.id);
		},
		[
			cancel,
			canonicalSource.id,
			clearTransientDragMotion,
			dragControls,
			pointer,
		],
	);

	return {
		dragControls,
		onPointerDown,
		onPointerUp,
		onPointerCancel,
		onDragStart,
		onDrag,
		onDragEnd,
		consumeClickSuppression,
	};
};
