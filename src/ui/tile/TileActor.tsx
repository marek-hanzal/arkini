import { motion } from "motion/react";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import { TileActorContent } from "~/ui/tile/TileActorContent";
import { useTileActorDrag } from "~/ui/tile/useTileActorDrag";
import { useTileActorMotion } from "~/ui/tile/useTileActorMotion";
import { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";
import { useTileHoverActions } from "~/ui/tile/useTileHoverActions";

export namespace TileActor {
	export interface Props {
		readonly item: useTileActors.Item;
		readonly live: boolean;
	}
}

/** Renders one stable runtime-item actor from focused presentation, Motion, and drag owners. */
export const TileActor = ({ item, live }: TileActor.Props) => {
	const presentation = useTileActorPresentation({
		item,
		live,
	});
	const actorMotion = useTileActorMotion({
		item,
		presentation,
	});
	const drag = useTileActorDrag({
		canonicalSource: presentation.canonicalSource,
		live,
		motion: actorMotion,
	});
	const hoverActions = useTileHoverActions({
		itemId: item.id,
		live: live && actorMotion.visible,
		onHoverChange: presentation.setHovered,
	});
	const dragSurfaceInteractionProps = hoverActions.getReferenceProps({
		onPointerDown: drag.onPointerDown,
		onPointerUp: drag.onPointerUp,
		onPointerCancel: drag.onPointerCancel,
	});
	const boardLocation = item.location.scope === "board" ? item.location : null;
	const visible = actorMotion.visible;

	return (
		<>
			<motion.button
				type="button"
				className="absolute left-0 top-0 overflow-visible border-0 bg-transparent p-0 text-inherit outline-none"
				style={{
					left: actorMotion.anchorX,
					top: actorMotion.anchorY,
					width: actorMotion.width,
					height: actorMotion.height,
					zIndex: presentation.zIndex,
					pointerEvents: live && visible ? "auto" : "none",
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
			>
				<motion.span
					ref={hoverActions.setReference}
					className="absolute inset-0 touch-none"
					style={{
						x: actorMotion.dragX,
						y: actorMotion.dragY,
					}}
					drag={live}
					dragControls={drag.dragControls}
					dragListener={false}
					dragMomentum={false}
					dragElastic={0}
					onDragStart={drag.onDragStart}
					onDrag={drag.onDrag}
					onDragEnd={drag.onDragEnd}
					data-ui="TileActorDragSurface"
					{...dragSurfaceInteractionProps}
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
			{hoverActions.actionBar}
		</>
	);
};
