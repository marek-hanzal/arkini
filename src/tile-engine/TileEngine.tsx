import { memo, type CSSProperties, useCallback, useState } from "react";
import { cn } from "~/ui/cn";
import { preventNativeTileEngineContextMenu } from "~/tile-engine/preventNativeTileEngineContextMenu";
import { TileEngineActors } from "~/tile-engine/TileEngineActors";
import { TileEngineSlots } from "~/tile-engine/TileEngineSlots";
import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";
import type { TileEngine as TileEngineType } from "~/tile-engine/TileEngine.types";
import { useTileEngineDrops } from "~/tile-engine/useTileEngineDrops";
import { useTileEngineHandoff } from "~/tile-engine/useTileEngineHandoff";
import { useTileEngineIndexes } from "~/tile-engine/useTileEngineIndexes";
import { useTileEngineMotionRequests } from "~/tile-engine/TileEngineMotionRequestStore";
import { useLatestRef } from "~/react/useLatestRef";
import { sameTileEngineDropFeedback } from "~/tile-engine/sameTileEngineDropFeedback";

const TileEngineComponent = <TTile, TSlot, TDrag, TDrop>({
	id,
	columns,
	slots,
	tiles,
	className,
	rootClassName,
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
				sameTileEngineDropFeedback(current, feedback) ? current : feedback,
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

	const isOverlayLayer = layerRole === "overlay";

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
				"relative min-w-0 shrink-0 overflow-visible p-1 [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] isolate",
				isOverlayLayer ? "[touch-action:pan-y]" : "touch-none",
				container === "responsive"
					? "w-[min(100cqw,calc((100cqh-0.5rem)*var(--ak-tile-engine-ratio)+0.5rem))]"
					: "w-full",
				disabled && "pointer-events-none",
				rootClassName,
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
				className={cn(
					"relative w-full overflow-visible aspect-[var(--ak-tile-engine-aspect)]",
					isOverlayLayer ? "[touch-action:pan-y]" : "touch-none",
					className,
				)}
			>
				<TileEngineSlots
					layerRole={layerRole}
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
					layerRole={layerRole}
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
