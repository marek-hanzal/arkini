import { Effect } from "effect";
import { motion } from "motion/react";
import { memo, useCallback, useContext, useMemo } from "react";
import { match } from "ts-pattern";

import { useStartItemDetailLine } from "~/bridge/item-detail/useStartItemDetailLine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import { CursorClassName } from "~/ui/cursor/CursorSemantic";
import type { InventoryControl } from "~/ui/inventory/InventoryControl";
import { InventoryContext } from "~/ui/inventory/InventoryContext";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { TileActorContent } from "~/ui/tile/TileActorContent";
import { readTileActorCursorSemantic } from "~/ui/tile/readTileActorCursorSemantic";
import { readTileActorStackingZIndex } from "~/ui/tile/TileActorStacking";
import { useTileActorDrag } from "~/ui/tile/useTileActorDrag";
import { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";

const unavailableInventoryControl = {
	openFx: () => Effect.succeed(false),
} satisfies Pick<InventoryControl, "openFx">;

export namespace TileActor {
	export interface Props {
		readonly item: useTileActors.Item;
	}
}

/** Renders one current tile actor with direct dragging and no animation lifecycle. */
const TileActorComponent = ({ item }: TileActor.Props) => {
	const itemDetail = useItemDetailControl();
	const inventory = useContext(InventoryContext) ?? unavailableInventoryControl;
	const startLine = useStartItemDetailLine();
	const presentation = useTileActorPresentation({
		item,
	});
	const { geometryVersion, interactionBlocked, readPlacement } = useTileActorSystem();
	const placement = useMemo(
		() => readPlacement(presentation.canonicalSource),
		[
			geometryVersion,
			presentation.canonicalSource,
			readPlacement,
		],
	);
	const interactive = placement !== null && !interactionBlocked && !itemDetail.isOpen;
	const drag = useTileActorDrag({
		canonicalSource: presentation.canonicalSource,
		live: interactive,
	});

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
						RendererRuntime.runSync(
							itemDetail.openItemDetailFx({
								itemId: item.id,
								tab: "lines",
								origin,
							}),
						);
					},
				)
				.with(
					{
						kind: "open-inventory",
					},
					() => {
						RendererRuntime.runSync(
							inventory.openFx({
								origin,
							}),
						);
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
							RendererRuntime.runSync(
								itemDetail.openItemDetailFx({
									itemId: item.id,
									tab: "lines",
									origin,
								}),
							);
						});
					},
				)
				.exhaustive(),
		[
			inventory,
			item.id,
			item.primaryAction,
			itemDetail,
			startLine,
		],
	);

	const visible = placement !== null;
	const boardLocation =
		item.location.scope === LocationScopeEnumSchema.enum.Board ? item.location : null;
	const zIndex = readTileActorStackingZIndex({
		location: item.location,
		phase: presentation.phase,
		localZIndex: presentation.zIndex,
	});
	const cursor = readTileActorCursorSemantic({
		feedback: presentation.feedback,
		forbiddenDrop: presentation.forbiddenDrop,
		live: interactive,
		phase: presentation.phase,
		running: item.running,
		visible,
	});

	return (
		<motion.button
			type="button"
			className={`absolute left-0 top-0 touch-none overflow-visible border-0 bg-transparent p-0 text-inherit outline-none ${CursorClassName[cursor]}`}
			style={{
				left: placement?.x ?? 0,
				top: placement?.y ?? 0,
				width: placement?.width ?? 0,
				height: placement?.height ?? 0,
				zIndex,
				pointerEvents: interactive ? "auto" : "none",
				visibility: visible ? "visible" : "hidden",
				x: drag.x,
				y: drag.y,
			}}
			drag={interactive}
			dragControls={drag.dragControls}
			dragListener={false}
			dragMomentum={false}
			dragElastic={0}
			aria-label={item.title}
			data-ui="TileActor"
			data-tile-actor="true"
			data-item-id={item.itemId}
			data-runtime-id={item.id}
			data-runtime-revision={item.revision}
			data-location-scope={item.location.scope}
			data-surface-id={presentation.canonicalSource.surface.id}
			data-phase={presentation.phase}
			data-board-x={boardLocation?.position.x}
			data-board-y={boardLocation?.position.y}
			data-toolbar-x={
				item.location.scope === LocationScopeEnumSchema.enum.Toolbar
					? item.location.position.x
					: undefined
			}
			data-dragging={presentation.phase === "dragging" ? "true" : "false"}
			data-primary-action={item.primaryAction.kind}
			onPointerDown={drag.onPointerDown}
			onPointerUp={drag.onPointerUp}
			onPointerCancel={drag.onPointerCancel}
			onDragStart={drag.onDragStart}
			onDrag={drag.onDrag}
			onDragEnd={drag.onDragEnd}
			onClick={(event) => {
				if (
					!interactive ||
					presentation.phase === "dragging" ||
					drag.consumeClickSuppression()
				) {
					return;
				}
				if (event.shiftKey) {
					event.preventDefault();
					RendererRuntime.runSync(
						itemDetail.openItemDetailFx({
							itemId: item.id,
							origin: event.currentTarget,
						}),
					);
					return;
				}
				if (item.primaryAction.kind === "none") return;
				runPrimaryAction(event.currentTarget);
			}}
		>
			<TileActorContent
				item={item}
				surfaceId={presentation.canonicalSource.surface.id}
				phase={presentation.phase}
				feedback={presentation.feedback}
				forbiddenDrop={presentation.forbiddenDrop}
			/>
		</motion.button>
	);
};

/** Exact item props form the safe bailout boundary for one actor identity. */
export const TileActor = memo(TileActorComponent);
