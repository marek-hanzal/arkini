import { motion } from "motion/react";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import { CursorClassName } from "~/ui/cursor/CursorSemantic";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { TileActorContent } from "~/ui/tile/TileActorContent";
import { readTileActorCursorSemantic } from "~/ui/tile/readTileActorCursorSemantic";
import { useTileActorDrag } from "~/ui/tile/useTileActorDrag";
import { useTileActorMotion } from "~/ui/tile/useTileActorMotion";
import { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";

export namespace TileActor {
	export interface Props {
		readonly item: useTileActors.Item;
		readonly live: boolean;
	}
}

/** Renders one stable runtime-item actor from focused presentation, Motion, and drag owners. */
export const TileActor = ({ item, live }: TileActor.Props) => {
	const itemDetail = useItemDetailControl();
	const presentation = useTileActorPresentation({
		item,
		live,
	});
	const actorMotion = useTileActorMotion({
		item,
		presentation,
	});
	const interactive = live && actorMotion.visible && !itemDetail.isOpen;
	const drag = useTileActorDrag({
		canonicalSource: presentation.canonicalSource,
		live: interactive,
		motion: actorMotion,
	});
	const boardLocation = item.location.scope === "board" ? item.location : null;
	const visible = actorMotion.visible;
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
				left: actorMotion.anchorX,
				top: actorMotion.anchorY,
				width: actorMotion.width,
				height: actorMotion.height,
				zIndex: presentation.zIndex,
				pointerEvents: interactive ? "auto" : "none",
				visibility: visible ? "visible" : "hidden",
			}}
			aria-label={item.title}
			data-ui="TileActor"
			data-tile-actor="true"
			data-item-id={item.itemId}
			data-runtime-id={item.id}
			data-runtime-revision={item.revision}
			data-location-scope={item.location.scope}
			data-board-x={boardLocation?.position.x}
			data-board-y={boardLocation?.position.y}
			data-toolbar-x={
				item.location.scope === "toolbar" ? item.location.position.x : undefined
			}
			data-dragging={presentation.phase === "dragging" ? "true" : "false"}
			onPointerEnter={() => {
				if (interactive) presentation.setHovered(true);
			}}
			onPointerLeave={() => presentation.setHovered(false)}
			onDoubleClick={(event) => {
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
				onPointerCancel={drag.onPointerCancel}
				onDragStart={drag.onDragStart}
				onDrag={drag.onDrag}
				onDragEnd={drag.onDragEnd}
				data-ui="TileActorDragSurface"
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
						onAnimationComplete={
							presentation.visualCompletionGeneration === null
								? undefined
								: actorMotion.onVisualAnimationComplete
						}
					/>
				</motion.span>
			</motion.span>
		</motion.button>
	);
};
