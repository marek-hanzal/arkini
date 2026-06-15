import { memo, type ReactNode, type RefObject } from "react";
import { cn } from "~/v0/style/cn";
import { TileEngineActor } from "~/v0/tile-engine/TileEngineActor";
import type { TileEngineActor as TileEngineActorType } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace TileEngineActors {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		tiles: readonly TileEngine.Tile<TTile>[];
		slotIndexById: ReadonlyMap<string, number>;
		columns: number;
		rowCount: number;
		gapPx: number;
		itemLayerClassName?: string;
		drag?: TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop>;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		resolveDrop(rect: TileEngine.Rect): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null;
		setActiveDropId(dropId: string | null): void;
		setHandoff(handoff: TileEngineActorType.Handoff | null): void;
		consumeHandoff(tileId: string, slotId: string): boolean;
		renderTile(props: TileEngine.RenderTileProps<TTile>): ReactNode;
	}
}

const TileEngineActorsComponent = <TTile, TSlot, TDrag, TDrop>({
	tiles,
	slotIndexById,
	columns,
	rowCount,
	gapPx,
	itemLayerClassName,
	drag,
	dragConstraintsRef,
	resolveDrop,
	setActiveDropId,
	setHandoff,
	consumeHandoff,
	renderTile,
}: TileEngineActors.Props<TTile, TSlot, TDrag, TDrop>) => (
	<div className={cn("pointer-events-none absolute inset-0", itemLayerClassName)}>
		{tiles.map((tile) => {
			const index = slotIndexById.get(tile.slotId);
			if (index === undefined) return null;

			return (
				<TileEngineActor
					key={tile.id}
					tile={tile}
					index={index}
					columns={columns}
					rowCount={rowCount}
					gapPx={gapPx}
					drag={drag}
					dragConstraintsRef={dragConstraintsRef}
					resolveDrop={resolveDrop}
					setActiveDropId={setActiveDropId}
					setHandoff={setHandoff}
					consumeHandoff={consumeHandoff}
					renderTile={renderTile}
				/>
			);
		})}
	</div>
);

export const TileEngineActors = memo(TileEngineActorsComponent) as typeof TileEngineActorsComponent;
