import { animate, motion, useDragControls, useMotionValue, type PanInfo } from "motion/react";
import {
	type PointerEventHandler,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import { useDropItem } from "~/bridge/tile/useDropItem";
import { isSameTileLocation } from "~/bridge/tile/isSameTileLocation";
import { TileActorContent } from "~/ui/tile/TileActorContent";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import { TileSystemContext } from "~/ui/tile/TileSystemContext";
import { tileLocationForTarget } from "~/ui/tile/tileLocationForTarget";
import { tileSlotForLocation } from "~/ui/tile/tileSlotForLocation";
import { tileSurfaceForLocation } from "~/ui/tile/tileSurfaceForLocation";

export namespace TileActor {
	export interface Props {
		readonly item: useTileActors.Item;
	}
}

const settleTransition = {
	type: "spring" as const,
	stiffness: 560,
	damping: 38,
	mass: 0.62,
};

const pickupTransition = {
	type: "tween" as const,
	duration: 0.11,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

/** Renders and physically moves one stable runtime-item actor through Motion. */
export const TileActor = ({ item }: TileActor.Props) => {
	const system = useContext(TileSystemContext);
	if (system === null) throw new Error("TileSystemProvider is missing.");
	const {
		active,
		geometryVersion,
		readPlacement,
		press,
		startDrag,
		moveDrag,
		release,
		settle,
		complete,
		cancel,
	} = system;
	const dropItem = useDropItem();
	const dragControls = useDragControls();
	const anchorX = useMotionValue(0);
	const anchorY = useMotionValue(0);
	const dragX = useMotionValue(0);
	const dragY = useMotionValue(0);
	const pickupX = useMotionValue(0);
	const pickupY = useMotionValue(0);
	const width = useMotionValue(0);
	const height = useMotionValue(0);
	const initialized = useRef(false);
	const localMotionGeneration = useRef(0);
	const dragStarted = useRef(false);
	const pickupTarget = useRef({
		x: 0,
		y: 0,
	});
	const pickupAnimationX = useRef<ReturnType<typeof animate> | null>(null);
	const pickupAnimationY = useRef<ReturnType<typeof animate> | null>(null);
	const itemRef = useRef(item);
	const [visible, setVisible] = useState(false);
	const [hovered, setHovered] = useState(false);
	itemRef.current = item;

	const stopPickupAnimation = useCallback(() => {
		pickupAnimationX.current?.stop();
		pickupAnimationY.current?.stop();
		pickupAnimationX.current = null;
		pickupAnimationY.current = null;
	}, []);

	const canonicalSource = useMemo<TileDragSource>(() => {
		const surface = tileSurfaceForLocation(item.location);
		return {
			id: item.id,
			revision: item.revision,
			location: item.location,
			surface,
			slot: tileSlotForLocation(item.location),
		};
	}, [
		item.id,
		item.location,
		item.revision,
	]);
	const ownsActive = active?.source.id === item.id;
	const targetItemId =
		active?.target?.kind === "slot" ? (active.target.occupant?.id ?? null) : null;
	const targeted =
		targetItemId === item.id &&
		(active?.phase === "dragging" || active?.phase === "awaiting-outcome");
	const swapTarget =
		active?.phase === "settling" &&
		active.outcome?.kind === "swap" &&
		active.outcome.target.itemId === item.id
			? active.outcome.target
			: null;
	const mergeOutcome =
		active?.phase === "settling" && active.outcome?.kind === "merge" ? active.outcome : null;
	const mergeStage =
		active?.phase === "settling" && active.outcome?.kind === "merge" ? active.mergeStage : null;
	const mergeSource = mergeOutcome?.source.itemId === item.id ? mergeOutcome.source : null;
	const mergeTarget = mergeOutcome?.target.itemId === item.id ? mergeOutcome.target : null;
	const settlement =
		active?.phase === "settling" && active.pendingActorIds.includes(item.id) ? active : null;
	const mergeTargetLocation =
		mergeOutcome?.target.current?.location ?? mergeOutcome?.target.previousLocation ?? null;
	const desiredLocation =
		mergeSource !== null && mergeStage === "approach" && mergeTargetLocation !== null
			? mergeTargetLocation
			: mergeSource !== null && mergeStage === "resolve"
				? (mergeSource.current?.location ?? mergeTargetLocation ?? item.location)
				: mergeTarget !== null
					? (mergeTarget.current?.location ?? mergeTarget.previousLocation)
					: ownsActive &&
							settlement?.settleLocation !== null &&
							settlement?.settleLocation !== undefined
						? settlement.settleLocation
						: (swapTarget?.location ?? item.location);
	const desiredSource = useMemo<TileDragSource>(() => {
		const surface = tileSurfaceForLocation(desiredLocation);
		return {
			id: item.id,
			revision: item.revision,
			location: desiredLocation,
			surface,
			slot: tileSlotForLocation(desiredLocation),
		};
	}, [
		desiredLocation,
		item.id,
		item.revision,
	]);
	const placement = readPlacement(desiredSource);
	void geometryVersion;
	const mergeApproachPositionOwned = mergeSource !== null && mergeStage === "approach";
	const mergeResolveSourcePositionOwned =
		mergeSource !== null && mergeStage === "resolve" && mergeSource.current !== null;
	const mergeResolveVisualOwned =
		settlement !== null &&
		mergeStage === "resolve" &&
		((mergeSource !== null && mergeSource.current === null) || mergeTarget !== null);
	const positionOwnedSettlement =
		settlement !== null &&
		(mergeOutcome === null || mergeApproachPositionOwned || mergeResolveSourcePositionOwned);
	const canCompletePosition = useCallback(() => {
		if (!positionOwnedSettlement) return false;
		if (mergeApproachPositionOwned) return true;
		if (mergeResolveSourcePositionOwned && mergeSource?.current !== null) {
			return isSameTileLocation(itemRef.current.location, mergeSource.current.location);
		}
		return isSameTileLocation(itemRef.current.location, desiredLocation);
	}, [
		desiredLocation,
		mergeApproachPositionOwned,
		mergeResolveSourcePositionOwned,
		mergeSource,
		positionOwnedSettlement,
	]);

	useLayoutEffect(() => {
		const pointerOwned =
			ownsActive &&
			(active?.phase === "pressed" ||
				active?.phase === "dragging" ||
				active?.phase === "awaiting-outcome");
		const frozenAwaitingTarget = targeted && active?.phase === "awaiting-outcome";
		if (pointerOwned || frozenAwaitingTarget) {
			// Motion owns the source pose while the pointer is active. The exact occupied
			// target also stays at its release pose until the engine outcome arrives.
			return;
		}
		const interaction = settlement;
		if (placement === null) {
			if (interaction === null) setVisible(false);
			return;
		}

		const generation = ++localMotionGeneration.current;
		if (!initialized.current) {
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			dragX.jump(0);
			dragY.jump(0);
			pickupX.jump(0);
			pickupY.jump(0);
			width.jump(placement.width);
			height.jump(placement.height);
			initialized.current = true;
			setVisible(true);
			if (interaction?.phase === "settling" && canCompletePosition()) {
				complete(item.id, interaction.generation);
			}
			return;
		}

		setVisible(true);
		stopPickupAnimation();
		const animations: Array<ReturnType<typeof animate>> = [];
		if (interaction?.phase === "settling") {
			const currentVisualX = anchorX.get() + dragX.get() + pickupX.get();
			const currentVisualY = anchorY.get() + dragY.get() + pickupY.get();
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			dragX.jump(currentVisualX - placement.x);
			dragY.jump(currentVisualY - placement.y);
			pickupX.jump(0);
			pickupY.jump(0);
			animations.push(
				animate(dragX, 0, settleTransition),
				animate(dragY, 0, settleTransition),
			);
		} else {
			animations.push(
				animate(anchorX, placement.x, settleTransition),
				animate(anchorY, placement.y, settleTransition),
				animate(dragX, 0, settleTransition),
				animate(dragY, 0, settleTransition),
				animate(pickupX, 0, settleTransition),
				animate(pickupY, 0, settleTransition),
			);
		}
		animations.push(
			animate(width, placement.width, settleTransition),
			animate(height, placement.height, settleTransition),
		);
		void Promise.all(animations).then(() => {
			if (localMotionGeneration.current !== generation) return;
			if (interaction?.phase === "settling" && canCompletePosition()) {
				complete(item.id, interaction.generation);
			}
		});
		return () => {
			for (const animation of animations) animation.stop();
		};
	}, [
		active,
		anchorX,
		anchorY,
		canCompletePosition,
		complete,
		desiredLocation,
		dragX,
		dragY,
		pickupX,
		pickupY,
		height,
		item.id,
		ownsActive,
		settlement,
		stopPickupAnimation,
		targeted,
		placement?.height,
		placement?.width,
		placement?.x,
		placement?.y,
		width,
	]);

	const onVisualAnimationComplete = useCallback(() => {
		if (!mergeResolveVisualOwned || active?.phase !== "settling") return;
		complete(item.id, active.generation);
	}, [
		active,
		complete,
		item.id,
		mergeResolveVisualOwned,
	]);

	useEffect(
		() => () => {
			localMotionGeneration.current += 1;
			stopPickupAnimation();
			dragControls.cancel();
			cancel(item.id);
		},
		[
			cancel,
			dragControls,
			item.id,
			stopPickupAnimation,
		],
	);

	const onPointerDown = useCallback<PointerEventHandler<HTMLSpanElement>>(
		(event) => {
			if (!event.isPrimary || event.button !== 0) return;
			if (!press(canonicalSource)) return;
			const bounds = event.currentTarget.getBoundingClientRect();
			pickupTarget.current = {
				x: event.clientX - (bounds.left + bounds.width / 2),
				y: event.clientY - (bounds.top + bounds.height / 2),
			};
			dragStarted.current = false;
			stopPickupAnimation();
			pickupX.jump(0);
			pickupY.jump(0);
			dragControls.start(event, {
				distanceThreshold: 6,
			});
		},
		[
			canonicalSource,
			dragControls,
			press,
			pickupX,
			pickupY,
			stopPickupAnimation,
		],
	);

	const onPointerUp = useCallback(() => {
		if (!dragStarted.current) cancel(item.id);
	}, [
		cancel,
		item.id,
	]);

	const onPointerCancel = useCallback(() => {
		stopPickupAnimation();
		dragControls.cancel();
		cancel(item.id);
	}, [
		cancel,
		dragControls,
		item.id,
		stopPickupAnimation,
	]);

	const onDragStart = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			dragStarted.current = true;
			startDrag(canonicalSource);
			stopPickupAnimation();
			pickupAnimationX.current = animate(pickupX, pickupTarget.current.x, pickupTransition);
			pickupAnimationY.current = animate(pickupY, pickupTarget.current.y, pickupTransition);
			moveDrag(canonicalSource, info.point.x, info.point.y);
		},
		[
			canonicalSource,
			moveDrag,
			pickupX,
			pickupY,
			startDrag,
			stopPickupAnimation,
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
			const released = release(item.id);
			if (released === null) {
				dragStarted.current = false;
				return;
			}
			const targetLocation = tileLocationForTarget(released.target);
			try {
				const outcome = await dropItem({
					sourceItemId: released.source.id,
					sourceRevision: released.source.revision,
					sourceLocation: released.source.location,
					target:
						targetLocation === null || released.target.kind !== "slot"
							? {
									kind: "unsupported",
								}
							: {
									kind: "slot",
									location: targetLocation,
									occupant:
										released.target.occupant === null
											? null
											: {
													itemId: released.target.occupant.id,
													revision: released.target.occupant.revision,
												},
								},
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
			dropItem,
			item.id,
			release,
			settle,
		],
	);

	const phase =
		settlement !== null &&
		mergeStage === "resolve" &&
		mergeSource !== null &&
		mergeSource.current === null
			? "exiting"
			: settlement !== null &&
					mergeStage === "resolve" &&
					mergeTarget !== null &&
					mergeTarget.current === null
				? "exiting"
				: settlement !== null && mergeStage === "resolve" && mergeTarget !== null
					? "impact"
					: ownsActive
						? active?.phase === "pressed"
							? hovered
								? "hovered"
								: "stable"
							: active?.phase === "dragging" || active?.phase === "awaiting-outcome"
								? "dragging"
								: settlement !== null
									? "settling"
									: "stable"
						: settlement !== null
							? "settling"
							: targeted || (mergeStage === "approach" && mergeTarget !== null)
								? "targeted"
								: hovered
									? "hovered"
									: "stable";
	const zIndex =
		phase === "dragging"
			? 40
			: phase === "settling" || phase === "impact" || phase === "exiting"
				? 30
				: phase === "targeted"
					? 25
					: phase === "hovered"
						? 20
						: 10;
	const boardLocation = item.location.scope === "board" ? item.location : null;

	return (
		<motion.button
			type="button"
			className="absolute left-0 top-0 overflow-visible border-0 bg-transparent p-0 text-inherit outline-none"
			style={{
				left: anchorX,
				top: anchorY,
				width,
				height,
				zIndex,
				pointerEvents: visible ? "auto" : "none",
				visibility: visible ? "visible" : "hidden",
			}}
			aria-label={item.title}
			data-ui="TileActor"
			data-tile-actor="true"
			data-item-id={item.itemId}
			data-runtime-id={item.id}
			data-runtime-revision={item.revision}
			data-board-x={boardLocation?.position.x}
			data-board-y={boardLocation?.position.y}
			data-dragging={phase === "dragging" ? "true" : "false"}
		>
			<motion.span
				className="absolute inset-0 touch-none"
				style={{
					x: dragX,
					y: dragY,
				}}
				drag
				dragControls={dragControls}
				dragListener={false}
				dragMomentum={false}
				dragElastic={0}
				onPointerDown={onPointerDown}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerCancel}
				onHoverStart={() => setHovered(true)}
				onHoverEnd={() => setHovered(false)}
				onDragStart={onDragStart}
				onDrag={onDrag}
				onDragEnd={onDragEnd}
				data-ui="TileActorDragSurface"
			>
				<motion.span
					className="absolute inset-0"
					style={{
						x: pickupX,
						y: pickupY,
					}}
					data-ui="TileActorPickup"
					data-motion-id={item.id}
				>
					<TileActorContent
						item={item}
						phase={phase}
						feedback={settlement !== null ? (active?.feedback ?? null) : null}
						onAnimationComplete={
							mergeResolveVisualOwned ? onVisualAnimationComplete : undefined
						}
					/>
				</motion.span>
			</motion.span>
		</motion.button>
	);
};
