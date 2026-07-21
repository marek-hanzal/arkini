import { useDragControls, type PanInfo } from "motion/react";
import { type PointerEventHandler, useCallback, useEffect, useRef } from "react";
import { match } from "ts-pattern";

import { useDropItem } from "~/bridge/tile/useDropItem";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import { useTileActorRetention } from "~/ui/tile/useTileActorRetention";
import { tileLocationForTarget } from "~/ui/tile/tileLocationForTarget";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";
import type { useTileActorMotion } from "~/ui/tile/useTileActorMotion";

/** Owns pointer arbitration, Motion drag controls, command handoff, and failure settlement. */
export const useTileActorDrag = ({
	canonicalSource,
	live,
	motion,
}: {
	readonly canonicalSource: TileDragSource;
	readonly live: boolean;
	readonly motion: Pick<
		ReturnType<typeof useTileActorMotion>,
		"armPickupCorrection" | "startPickupCorrection" | "stopPickupCorrection"
	>;
}) => {
	const { armPickupCorrection, startPickupCorrection, stopPickupCorrection } = motion;
	const retainActorIds = useTileActorRetention();
	const { press, startDrag, moveDrag, release, settle, cancel } = useTileActorSystem();
	const dropItem = useDropItem();
	const dragControls = useDragControls();
	const dragStarted = useRef(false);
	const suppressClick = useRef(false);

	const onPointerDown = useCallback<PointerEventHandler<HTMLSpanElement>>(
		(event) => {
			if (!live || !event.isPrimary || event.button !== 0) return;
			if (!press(canonicalSource)) return;
			retainActorIds([
				canonicalSource.id,
			]);
			const bounds = event.currentTarget.getBoundingClientRect();
			armPickupCorrection({
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
			dragControls,
			live,
			armPickupCorrection,
			press,
			retainActorIds,
		],
	);

	const onPointerUp = useCallback(() => {
		if (!dragStarted.current) cancel(canonicalSource.id);
	}, [
		cancel,
		canonicalSource.id,
	]);

	const onPointerCancel = useCallback(() => {
		stopPickupCorrection();
		dragControls.cancel();
		cancel(canonicalSource.id);
	}, [
		cancel,
		canonicalSource.id,
		dragControls,
		stopPickupCorrection,
	]);

	const onDragStart = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			dragStarted.current = true;
			suppressClick.current = true;
			startDrag(canonicalSource);
			startPickupCorrection();
			moveDrag(canonicalSource, info.point.x, info.point.y);
		},
		[
			canonicalSource,
			startPickupCorrection,
			moveDrag,
			startDrag,
		],
	);

	const onDrag = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			moveDrag(canonicalSource, info.point.x, info.point.y);
		},
		[
			canonicalSource,
			moveDrag,
		],
	);

	const onDragEnd = useCallback(
		async (_event: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
			const released = release(canonicalSource.id);
			if (released === null) {
				dragStarted.current = false;
				return;
			}
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
				settle(released.source, released.generation, outcome);
			} catch (error) {
				console.error("Tile drop failed.", error);
				settle(released.source, released.generation, null);
			} finally {
				dragStarted.current = false;
			}
		},
		[
			canonicalSource.id,
			dropItem,
			release,
			retainActorIds,
			settle,
		],
	);

	const consumeClickSuppression = useCallback(() => {
		const suppressed = suppressClick.current;
		suppressClick.current = false;
		return suppressed;
	}, []);

	useEffect(
		() => () => {
			stopPickupCorrection();
			dragControls.cancel();
			cancel(canonicalSource.id);
		},
		[
			cancel,
			canonicalSource.id,
			dragControls,
			stopPickupCorrection,
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
