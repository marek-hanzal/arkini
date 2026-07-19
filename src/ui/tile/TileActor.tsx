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
	const width = useMotionValue(0);
	const height = useMotionValue(0);
	const initialized = useRef(false);
	const localMotionGeneration = useRef(0);
	const dragStarted = useRef(false);
	const itemRef = useRef(item);
	const [visible, setVisible] = useState(false);
	const [hovered, setHovered] = useState(false);
	itemRef.current = item;

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
	const desiredLocation =
		ownsActive && active?.phase === "settling" && active.settleLocation !== null
			? active.settleLocation
			: item.location;
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

	useLayoutEffect(() => {
		const interaction = ownsActive ? active : null;
		if (
			interaction?.phase === "pressed" ||
			interaction?.phase === "dragging" ||
			interaction?.phase === "awaiting-outcome"
		) {
			// Motion may already have centered the actor under the pointer. Do not let
			// canonical anchor reconciliation erase that gesture-owned offset before
			// the drag threshold is crossed.
			return;
		}
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
			width.jump(placement.width);
			height.jump(placement.height);
			initialized.current = true;
			setVisible(true);
			if (
				interaction?.phase === "settling" &&
				isSameTileLocation(itemRef.current.location, desiredLocation)
			) {
				complete(item.id, interaction.generation);
			}
			return;
		}

		setVisible(true);
		const animations: Array<ReturnType<typeof animate>> = [];
		if (interaction?.phase === "settling") {
			const currentVisualX = anchorX.get() + dragX.get();
			const currentVisualY = anchorY.get() + dragY.get();
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			dragX.jump(currentVisualX - placement.x);
			dragY.jump(currentVisualY - placement.y);
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
			);
		}
		animations.push(
			animate(width, placement.width, settleTransition),
			animate(height, placement.height, settleTransition),
		);
		void Promise.all(animations).then(() => {
			if (localMotionGeneration.current !== generation) return;
			if (
				interaction?.phase === "settling" &&
				isSameTileLocation(itemRef.current.location, desiredLocation)
			) {
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
		complete,
		desiredLocation,
		dragX,
		dragY,
		height,
		item.id,
		ownsActive,
		placement?.height,
		placement?.width,
		placement?.x,
		placement?.y,
		width,
	]);

	useEffect(
		() => () => {
			localMotionGeneration.current += 1;
			dragControls.cancel();
			cancel(item.id);
		},
		[
			cancel,
			dragControls,
			item.id,
		],
	);

	const onPointerDown = useCallback<PointerEventHandler<HTMLSpanElement>>(
		(event) => {
			if (!event.isPrimary || event.button !== 0) return;
			if (!press(canonicalSource)) return;
			dragStarted.current = false;
			dragControls.start(event, {
				snapToCursor: true,
				distanceThreshold: 6,
			});
		},
		[
			canonicalSource,
			dragControls,
			press,
		],
	);

	const onPointerUp = useCallback(() => {
		if (!dragStarted.current) cancel(item.id);
	}, [
		cancel,
		item.id,
	]);

	const onPointerCancel = useCallback(() => {
		dragControls.cancel();
		cancel(item.id);
	}, [
		cancel,
		dragControls,
		item.id,
	]);

	const onDragStart = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			dragStarted.current = true;
			startDrag(canonicalSource);
			moveDrag(canonicalSource, info.point.x, info.point.y);
		},
		[
			canonicalSource,
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
			dragStarted.current = false;
			const released = release(item.id);
			if (released === null) return;
			const targetLocation = tileLocationForTarget(released.target);
			try {
				const outcome = await dropItem({
					sourceItemId: released.source.id,
					sourceRevision: released.source.revision,
					sourceLocation: released.source.location,
					target:
						targetLocation === null
							? {
									kind: "unsupported",
								}
							: {
									kind: "slot",
									location: targetLocation,
								},
				});
				settle(released.source, released.generation, outcome);
			} catch (error) {
				console.error("Tile drop failed.", error);
				settle(released.source, released.generation, null);
			}
		},
		[
			dropItem,
			item.id,
			release,
			settle,
		],
	);

	const phase = ownsActive
		? active?.phase === "pressed"
			? "pressed"
			: active?.phase === "dragging" || active?.phase === "awaiting-outcome"
				? "dragging"
				: active?.phase === "settling"
					? "settling"
					: "stable"
		: hovered
			? "hovered"
			: "stable";
	const zIndex =
		phase === "dragging" ? 40 : phase === "settling" ? 30 : phase === "hovered" ? 20 : 10;
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
				<TileActorContent
					item={item}
					phase={phase}
					feedback={ownsActive ? (active?.feedback ?? null) : null}
				/>
			</motion.span>
		</motion.button>
	);
};
