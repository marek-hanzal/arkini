import { memo, type ReactNode, type RefObject } from "react";
import { cn } from "~/ui/cn";
import { TileEngineActor } from "~/tile-engine/TileEngineActor";
import type { TileEngineActor as TileEngineActorType } from "~/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/tile-engine/TileEngineDrop.types";
import type { TileEngineMotionSchema } from "~/tile-engine/TileEngineMotionSchema";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace TileEngineActors {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		layerRole: TileEngine.LayerRole;
		tiles: readonly TileEngine.Tile<TTile>[];
		slotIndexById: ReadonlyMap<string, number>;
		columns: number;
		rowCount: number;
		gapPx: number;
		actorLayerClassName?: string;
		dragRef: RefObject<TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop> | undefined>;
		dragDisabled: boolean;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		motionByTileId: ReadonlyMap<string, TileEngineMotionSchema.Type>;
		resolveDrop(rect: TileEngine.Rect): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null;
		activeDropFeedback: TileEngine.ActiveDropFeedback | null;
		setActiveDropId(dropId: string | null): void;
		setActiveDropFeedback(feedback: TileEngine.ActiveDropFeedback | null): void;
		setHandoff(handoff: TileEngineActorType.Handoff | null): void;
		setHandoffs(handoffs: readonly TileEngineActorType.Handoff[]): void;
		consumeHandoff(tileId: string, slotId: string): boolean;
		renderTile(props: TileEngine.RenderTileProps<TTile>): ReactNode;
	}
}

const TileEngineActorsComponent = <TTile, TSlot, TDrag, TDrop>({
	layerRole,
	tiles,
	slotIndexById,
	columns,
	rowCount,
	gapPx,
	actorLayerClassName,
	dragRef,
	dragDisabled,
	dragConstraintsRef,
	motionByTileId,
	resolveDrop,
	activeDropFeedback,
	setActiveDropId,
	setActiveDropFeedback,
	setHandoff,
	setHandoffs,
	consumeHandoff,
	renderTile,
}: TileEngineActors.Props<TTile, TSlot, TDrag, TDrop>) => (
	<div
		className={cn(
			"pointer-events-none absolute inset-0 grid h-full w-full",
			layerRole === "overlay" ? "[touch-action:pan-y]" : "touch-none",
			actorLayerClassName,
		)}
		style={{
			zIndex:
				layerRole === "overlay"
					? "var(--ak-layer-overlay-tile)"
					: "var(--ak-layer-base-tile)",
			gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
			gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
			gap: gapPx,
		}}
	>
		{tiles.map((tile) => {
			const index = slotIndexById.get(tile.slotId);
			if (index === undefined) return null;
			const motion = motionByTileId.get(tile.id);

			const tileDropFeedback =
				activeDropFeedback?.targetTileId === tile.id ? activeDropFeedback : null;

			return (
				<TileEngineActor
					key={tile.id}
					layerRole={layerRole}
					tile={tile}
					enter={motion?.enter}
					exit={motion?.exit}
					feedback={motion?.feedback}
					index={index}
					columns={columns}
					rowCount={rowCount}
					gapPx={gapPx}
					dragRef={dragRef}
					dragDisabled={dragDisabled}
					dragConstraintsRef={dragConstraintsRef}
					resolveDrop={resolveDrop}
					dropFeedback={tileDropFeedback}
					setActiveDropId={setActiveDropId}
					setActiveDropFeedback={setActiveDropFeedback}
					setHandoff={setHandoff}
					setHandoffs={setHandoffs}
					consumeHandoff={consumeHandoff}
					renderTile={renderTile}
				/>
			);
		})}
	</div>
);

export const TileEngineActors = memo(TileEngineActorsComponent) as typeof TileEngineActorsComponent;
