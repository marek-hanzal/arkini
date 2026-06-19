import { memo, type CSSProperties, useCallback, useState } from "react";
import { cn } from "~/v0/ui/cn";
import { preventNativeTileEngineContextMenu } from "~/v0/tile-engine/preventNativeTileEngineContextMenu";
import { TileEngineActors } from "~/v0/tile-engine/TileEngineActors";
import { TileEngineSlots } from "~/v0/tile-engine/TileEngineSlots";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngine as TileEngineType } from "~/v0/tile-engine/TileEngine.types";
import { useTileEngineDrops } from "~/v0/tile-engine/useTileEngineDrops";
import { useTileEngineHandoff } from "~/v0/tile-engine/useTileEngineHandoff";
import { useTileEngineIndexes } from "~/v0/tile-engine/useTileEngineIndexes";
import { useTileEngineMotionRequests } from "~/v0/tile-engine/TileEngineMotionRequestStore";
import { useLatestRef } from "~/v0/react/useLatestRef";

export type { TileEngine as TileEngineNamespace } from "~/v0/tile-engine/TileEngine.types";

const sameActiveDropFeedback = (
	left: TileEngineType.ActiveDropFeedback | null,
	right: TileEngineType.ActiveDropFeedback | null,
) =>
	left?.dropId === right?.dropId &&
	left?.effect === right?.effect &&
	left?.variant === right?.variant &&
	left?.targetTileId === right?.targetTileId;

const TileEngineComponent = <TTile, TSlot, TDrag, TDrop>({
	id,
	columns,
	slots,
	tiles,
	className,
	cellClassName,
	actorLayerClassName,
	disabled = false,
	layerRole = "base",
	container = "static",
	gapPx = TileEngineTiming.defaultGapPx,
	rootRef,
	drag,
	dragConstraintsRef,
	renderSlot,
	renderTile,
}: TileEngineType.Props<TTile, TSlot, TDrag, TDrop>) => {
	const [activeDropId, setRawActiveDropId] = useState<string | null>(null);
	const [activeDropFeedback, setRawActiveDropFeedback] =
		useState<TileEngineType.ActiveDropFeedback | null>(null);
	const setRootNode = useCallback(
		(node: HTMLDivElement | null) => {
			if (rootRef) {
				(
					rootRef as {
						current: HTMLDivElement | null;
					}
				).current = node;
			}
		},
		[
			rootRef,
		],
	);
	const setActiveDropFeedback = useCallback(
		(feedback: TileEngineType.ActiveDropFeedback | null) => {
			setRawActiveDropFeedback((current) =>
				sameActiveDropFeedback(current, feedback) ? current : feedback,
			);
		},
		[],
	);
	const setActiveDropId = useCallback((dropId: string | null) => {
		setRawActiveDropId((current) => (current === dropId ? current : dropId));
		if (!dropId) setRawActiveDropFeedback(null);
	}, []);
	const indexes = useTileEngineIndexes({
		columns,
		slots,
		tiles,
	});
	const motionByTileId = useTileEngineMotionRequests(id);
	const dragRef = useLatestRef(disabled ? undefined : drag);
	const drops = useTileEngineDrops<TSlot, TTile, TDrop>();
	const handoff = useTileEngineHandoff();
	const rowCount = Math.max(1, indexes.rowCount);

	return (
		<div
			ref={setRootNode}
			onContextMenu={preventNativeTileEngineContextMenu}
			data-ui="tile engine"
			data-ak-tile-engine-id={id}
			data-ak-tile-engine-layer-role={layerRole}
			data-ak-tile-engine-container={container}
			data-ak-tile-engine-disabled={disabled ? "true" : undefined}
			className={cn(
				"ak-tile-engine relative min-w-0 shrink-0 overflow-visible p-1",
				disabled && "pointer-events-none",
			)}
			style={
				{
					"--ak-tile-engine-aspect": `${columns} / ${rowCount}`,
					"--ak-tile-engine-ratio": columns / rowCount,
				} as CSSProperties
			}
		>
			<div
				data-ui="tile engine grid"
				className={cn("ak-tile-engine-grid relative w-full overflow-visible", className)}
			>
				<TileEngineSlots
					columns={columns}
					rowCount={rowCount}
					gapPx={gapPx}
					slots={slots}
					tileBySlotId={indexes.tileBySlotId}
					activeDropId={activeDropId}
					activeDropFeedback={activeDropFeedback}
					cellClassName={cellClassName}
					disabled={disabled}
					dragRef={dragRef}
					renderSlot={renderSlot}
					registerDrop={drops.registerDrop}
				/>

				<TileEngineActors
					tiles={tiles}
					slotIndexById={indexes.slotIndexById}
					columns={columns}
					rowCount={rowCount}
					gapPx={gapPx}
					actorLayerClassName={actorLayerClassName}
					dragRef={dragRef}
					dragDisabled={disabled || !drag}
					dragConstraintsRef={dragConstraintsRef}
					motionByTileId={motionByTileId}
					resolveDrop={drops.resolveDrop}
					setActiveDropId={setActiveDropId}
					setActiveDropFeedback={setActiveDropFeedback}
					activeDropFeedback={activeDropFeedback}
					setHandoff={handoff.setHandoff}
					setHandoffs={handoff.setHandoffs}
					consumeHandoff={handoff.consumeHandoff}
					renderTile={renderTile}
				/>
			</div>
		</div>
	);
};

export const TileEngine = memo(TileEngineComponent) as typeof TileEngineComponent;
