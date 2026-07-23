import { motion } from "motion/react";
import { memo, useCallback, useEffect, useRef } from "react";
import { match } from "ts-pattern";

import { useStartItemDetailLine } from "~/bridge/item-detail/useStartItemDetailLine";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import { CursorClassName } from "~/ui/cursor/CursorSemantic";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { TileActorContent } from "~/ui/tile/TileActorContent";
import { readTileActorCursorSemantic } from "~/ui/tile/readTileActorCursorSemantic";
import { useTileActorDrag } from "~/ui/tile/useTileActorDrag";
import { useTileActorMotion } from "~/ui/tile/useTileActorMotion";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";

const primaryActionDelayMs = 320;

const zIndexForCue = (cue: TileMotionCueSchema.Type | null) => {
	if (cue === null) return 0;
	return match(cue.kind)
		.with("exit", "consume-exit", "deplete-exit", "expiry", () => 35)
		.with(
			"morph",
			"absorb",
			"impact",
			"accept",
			"consume",
			"complete",
			"charge",
			"pause",
			"resume",
			"deplete",
			() => 30,
		)
		.with("spawn", "settle", () => 15)
		.exhaustive();
};

export namespace TileActor {
	export interface Props {
		readonly item: useTileActors.Item;
		readonly live: boolean;
		readonly cue: TileMotionCueSchema.Type | null;
		readonly morphPreviousItem: useTileActors.Item | null;
		readonly onCueStart: (itemId: string, generation: number) => void;
		readonly onCueContact: (itemId: string, generation: number) => void;
		readonly onCueComplete: (itemId: string, generation: number) => void;
	}
}

/** Renders one stable runtime-item actor from focused presentation, Motion, and drag owners. */
const TileActorComponent = ({
	item,
	live,
	cue,
	morphPreviousItem,
	onCueStart,
	onCueContact,
	onCueComplete,
}: TileActor.Props) => {
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
	const interactive = live && actorMotion.placement.visible && !itemDetail.isOpen;
	const drag = useTileActorDrag({
		canonicalSource: presentation.canonicalSource,
		live: interactive,
		pointer: actorMotion.pointer.commands,
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

	const boardLocation =
		item.location.scope === LocationScopeEnumSchema.enum.Board ? item.location : null;
	const visible = actorMotion.placement.visible;
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
			type="button"
			className={`absolute left-0 top-0 overflow-visible border-0 bg-transparent p-0 text-inherit outline-none ${CursorClassName[cursor]}`}
			style={{
				left: actorMotion.placement.anchor.x,
				top: actorMotion.placement.anchor.y,
				width: actorMotion.placement.width,
				height: actorMotion.placement.height,
				zIndex,
				pointerEvents: interactive ? "auto" : "none",
				visibility: visible ? "visible" : "hidden",
				x: actorMotion.neighbour.values.x,
				y: actorMotion.neighbour.values.y,
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
				item.location.scope === LocationScopeEnumSchema.enum.Toolbar
					? item.location.position.x
					: undefined
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
				className="absolute inset-0 z-10 touch-none"
				style={{
					x: actorMotion.pointer.values.direct.x,
					y: actorMotion.pointer.values.direct.y,
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
			/>
			<motion.span
				className="pointer-events-none absolute inset-0"
				style={{
					x: actorMotion.travel.x,
					y: actorMotion.travel.y,
				}}
				data-ui="TileActorTravel"
				data-motion-id={item.id}
			>
				<motion.span
					className="absolute inset-0"
					style={{
						x: actorMotion.pointer.values.direct.x,
						y: actorMotion.pointer.values.direct.y,
					}}
					data-ui="TileActorPointer"
					data-motion-id={item.id}
				>
					<motion.span
						className="absolute inset-0"
						style={{
							x: actorMotion.pointer.values.physical.x,
							y: actorMotion.pointer.values.physical.y,
							rotate: actorMotion.pointer.values.physical.rotation,
						}}
						data-ui="TileActorPhysicalResponse"
						data-motion-id={item.id}
					>
						<motion.span
							className="absolute inset-0"
							style={{
								x: actorMotion.pointer.values.pickup.x,
								y: actorMotion.pointer.values.pickup.y,
							}}
							data-ui="TileActorPickup"
							data-motion-id={item.id}
						>
							<motion.span
								className="absolute inset-0"
								style={{
									scale: actorMotion.neighbour.values.scale,
								}}
								data-ui="TileActorNeighbourEmphasis"
								data-motion-id={item.id}
							>
								<TileActorContent
									item={item}
									registerActorNode={actorMotion.neighbour.registerActorNode}
									surfaceId={presentation.canonicalSource.surface.id}
									live={live}
									exiting={
										presentation.phase === "exiting" ||
										cue?.kind === "exit" ||
										cue?.kind === "consume-exit"
									}
									phase={presentation.phase}
									feedback={presentation.feedback}
									forbiddenDrop={presentation.forbiddenDrop}
									cue={cue}
									morphPreviousItem={morphPreviousItem}
									cueOriginOffset={actorMotion.cueGeometry.originOffset}
									cueTargetOffset={actorMotion.cueGeometry.targetOffset}
									spawnDeliveryTiming={actorMotion.travel.spawnDeliveryTiming}
									spawnDeliveryReady={actorMotion.travel.spawnDeliveryReady}
									onCueStart={(generation) => onCueStart(item.id, generation)}
									onCueContact={(generation) => onCueContact(item.id, generation)}
									onCueComplete={(generation) =>
										onCueComplete(item.id, generation)
									}
									onInteractionAnimationComplete={
										presentation.visualCompletionGeneration === null
											? undefined
											: actorMotion.completion.onVisualComplete
									}
								/>
							</motion.span>
						</motion.span>
					</motion.span>
				</motion.span>
			</motion.span>
		</motion.button>
	);
};

/** Exact props form the complete safe bailout boundary for one actor identity. */
export const TileActor = memo(TileActorComponent);
