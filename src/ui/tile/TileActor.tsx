import { motion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { match } from "ts-pattern";

import { useStartItemDetailLine } from "~/bridge/item-detail/useStartItemDetailLine";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import { CursorClassName } from "~/ui/cursor/CursorSemantic";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { TileActorContent } from "~/ui/tile/TileActorContent";
import { readTileActorCursorSemantic } from "~/ui/tile/readTileActorCursorSemantic";
import { useTileActorDrag } from "~/ui/tile/useTileActorDrag";
import { useTileActorMotion } from "~/ui/tile/useTileActorMotion";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";

const primaryActionDelayMs = 320;

const zIndexForCue = (cue: TileMotionCueSchema.Type | null) => {
	if (cue === null) return 0;
	return match(cue.kind)
		.with("exit", () => 35)
		.with("absorb", "impact", "accept", "consume", "consume-exit", () => 30)
		.with("spawn", "settle", () => 15)
		.exhaustive();
};

export namespace TileActor {
	export interface Props {
		readonly item: useTileActors.Item;
		readonly live: boolean;
		readonly cue: TileMotionCueSchema.Type | null;
		readonly onCueComplete: (itemId: string, generation: number) => void;
	}
}

/** Renders one stable runtime-item actor from focused presentation, Motion, and drag owners. */
export const TileActor = ({ item, live, cue, onCueComplete }: TileActor.Props) => {
	const itemDetail = useItemDetailControl();
	const startLine = useStartItemDetailLine();
	const presentation = useTileActorPresentation({
		item,
		live,
	});
	const actorMotion = useTileActorMotion({
		item,
		presentation,
		cue,
	});
	const interactive = live && actorMotion.visible && !itemDetail.isOpen;
	const drag = useTileActorDrag({
		canonicalSource: presentation.canonicalSource,
		live: interactive,
		motion: actorMotion,
	});
	const pendingPrimaryAction = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cancelPendingPrimaryAction = useCallback(() => {
		if (pendingPrimaryAction.current === null) return;
		clearTimeout(pendingPrimaryAction.current);
		pendingPrimaryAction.current = null;
	}, []);
	const runPrimaryAction = useCallback(
		(origin: HTMLElement) =>
			match(item.primaryAction)
				.with(
					{
						kind: "none",
					},
					() => undefined,
				)
				.with(
					{
						kind: "open-lines",
					},
					() => {
						itemDetail.openItemDetail({
							itemId: item.id,
							tab: "lines",
							origin,
						});
					},
				)
				.with(
					{
						kind: "start-default-line",
					},
					({ lineId }) => {
						void startLine({
							ownerItemId: item.id,
							lineId,
						}).catch(() => {
							itemDetail.openItemDetail({
								itemId: item.id,
								tab: "lines",
								origin,
							});
						});
					},
				)
				.exhaustive(),
		[
			item.id,
			item.primaryAction,
			itemDetail,
			startLine,
		],
	);

	useEffect(() => {
		if (!interactive) cancelPendingPrimaryAction();
		return cancelPendingPrimaryAction;
	}, [
		cancelPendingPrimaryAction,
		interactive,
	]);

	const boardLocation = item.location.scope === LocationScopeEnumSchema.enum.Board ? item.location : null;
	const visible = actorMotion.visible;
	const zIndex = Math.max(presentation.zIndex, zIndexForCue(cue));
	const cursor = readTileActorCursorSemantic({
		feedback: presentation.feedback,
		forbiddenDrop: presentation.forbiddenDrop,
		hovered: presentation.hovered,
		live: interactive,
		phase: presentation.phase,
		running: item.running,
		visible,
	});

	return (
		<motion.button
			ref={actorMotion.registerActorNode}
			type="button"
			className={`absolute left-0 top-0 overflow-visible border-0 bg-transparent p-0 text-inherit outline-none ${CursorClassName[cursor]}`}
			style={{
				left: actorMotion.anchorX,
				top: actorMotion.anchorY,
				width: actorMotion.width,
				height: actorMotion.height,
				zIndex,
				pointerEvents: interactive ? "auto" : "none",
				visibility: visible ? "visible" : "hidden",
				x: actorMotion.neighbourX,
				y: actorMotion.neighbourY,
			}}
			aria-label={item.title}
			data-ui="TileActor"
			data-motion-id={item.id}
			data-tile-actor="true"
			data-item-id={item.itemId}
			data-runtime-id={item.id}
			data-runtime-revision={item.revision}
			data-location-scope={item.location.scope}
			data-surface-id={presentation.canonicalSource.surface.id}
			data-live={live ? "true" : "false"}
			data-motion-phase={presentation.phase}
			data-motion-exiting={
				presentation.phase === "exiting" ||
				cue?.kind === "exit" ||
				cue?.kind === "consume-exit"
					? "true"
					: "false"
			}
			data-board-x={boardLocation?.position.x}
			data-board-y={boardLocation?.position.y}
			data-toolbar-x={
				item.location.scope === LocationScopeEnumSchema.enum.Toolbar ? item.location.position.x : undefined
			}
			data-dragging={presentation.phase === "dragging" ? "true" : "false"}
			data-primary-action={item.primaryAction.kind}
			onPointerEnter={() => {
				if (interactive) presentation.setHovered(true);
			}}
			onPointerLeave={() => presentation.setHovered(false)}
			onClick={(event) => {
				if (
					!interactive ||
					presentation.phase === "dragging" ||
					drag.consumeClickSuppression()
				) {
					cancelPendingPrimaryAction();
					return;
				}
				if (event.detail > 1) {
					cancelPendingPrimaryAction();
					return;
				}
				if (item.primaryAction.kind === "none") return;
				const origin = event.currentTarget;
				cancelPendingPrimaryAction();
				pendingPrimaryAction.current = setTimeout(() => {
					pendingPrimaryAction.current = null;
					runPrimaryAction(origin);
				}, primaryActionDelayMs);
			}}
			onDoubleClick={(event) => {
				cancelPendingPrimaryAction();
				if (!interactive || presentation.phase === "dragging") return;
				event.preventDefault();
				event.stopPropagation();
				presentation.setHovered(false);
				itemDetail.openItemDetail({
					itemId: item.id,
					origin: event.currentTarget,
				});
			}}
		>
			<motion.span
				className="absolute inset-0 touch-none"
				style={{
					x: actorMotion.dragX,
					y: actorMotion.dragY,
				}}
				drag={interactive}
				dragControls={drag.dragControls}
				dragListener={false}
				dragMomentum={false}
				dragElastic={0}
				onPointerDown={drag.onPointerDown}
				onPointerUp={drag.onPointerUp}
				onPointerCancel={() => {
					cancelPendingPrimaryAction();
					drag.onPointerCancel();
				}}
				onDragStart={(event, info) => {
					cancelPendingPrimaryAction();
					drag.onDragStart(event, info);
				}}
				onDrag={drag.onDrag}
				onDragEnd={drag.onDragEnd}
				data-ui="TileActorDragSurface"
			>
				<motion.span
					className="absolute inset-0"
					style={{
						x: actorMotion.dragWeightX,
						y: actorMotion.dragWeightY,
						rotate: actorMotion.dragRotation,
					}}
					data-ui="TileActorWeight"
					data-motion-id={item.id}
				>
					<motion.span
						className="absolute inset-0"
						style={{
							x: actorMotion.pickupX,
							y: actorMotion.pickupY,
						}}
						data-ui="TileActorPickup"
						data-motion-id={item.id}
					>
						<TileActorContent
							item={item}
							phase={presentation.phase}
							feedback={presentation.feedback}
							cue={cue}
							cueOriginOffset={actorMotion.cueOriginOffset}
							cueTargetOffset={actorMotion.cueTargetOffset}
							onCueComplete={(generation) => onCueComplete(item.id, generation)}
							onInteractionAnimationComplete={
								presentation.visualCompletionGeneration === null
									? undefined
									: actorMotion.onVisualAnimationComplete
							}
						/>
					</motion.span>
				</motion.span>
			</motion.span>
		</motion.button>
	);
};
