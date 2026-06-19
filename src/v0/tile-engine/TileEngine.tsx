import { memo, useCallback, useEffect, useState } from "react";
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

const resolveResponsiveSize = ({
	columns,
	height,
	rowCount,
	width,
}: {
	columns: number;
	height: number;
	rowCount: number;
	width: number;
}) => {
	const ratio = columns / Math.max(1, rowCount);
	const resolvedWidth = Math.min(width, height * ratio);
	const resolvedHeight = resolvedWidth / ratio;

	return {
		height: resolvedHeight,
		width: resolvedWidth,
	};
};

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
	const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
	const [responsiveSize, setResponsiveSize] = useState<{
		height: number;
		width: number;
	} | null>(null);
	const [activeDropId, setRawActiveDropId] = useState<string | null>(null);
	const [activeDropFeedback, setRawActiveDropFeedback] =
		useState<TileEngineType.ActiveDropFeedback | null>(null);
	const setRootNode = useCallback(
		(node: HTMLDivElement | null) => {
			setRootElement(node);
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

	useEffect(() => {
		if (container !== "responsive" || !rootElement?.parentElement) {
			setResponsiveSize(null);
			return;
		}

		const parent = rootElement.parentElement;
		let frame = 0;
		const update = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const rect = parent.getBoundingClientRect();
				if (rect.width <= 0 || rect.height <= 0) return;
				setResponsiveSize(
					resolveResponsiveSize({
						columns,
						height: rect.height,
						rowCount,
						width: rect.width,
					}),
				);
			});
		};

		update();
		const observer = new ResizeObserver(update);
		observer.observe(parent);

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [
		columns,
		container,
		rootElement,
		rowCount,
	]);

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
				"ak-tile-engine relative min-w-0 shrink-0 overflow-visible",
				container === "static" && "h-auto w-full",
				disabled && "pointer-events-none",
				className,
			)}
			style={{
				aspectRatio: `${columns}/${rowCount}`,
				height: container === "responsive" ? (responsiveSize?.height ?? "100%") : undefined,
				width: container === "responsive" ? (responsiveSize?.width ?? "100%") : undefined,
			}}
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
	);
};

export const TileEngine = memo(TileEngineComponent) as typeof TileEngineComponent;
