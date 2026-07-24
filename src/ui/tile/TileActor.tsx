import { motion } from "motion/react";
import { memo, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { match } from "ts-pattern";

import { useStartItemDetailLine } from "~/bridge/item-detail/useStartItemDetailLine";
import { isSameTileLocation } from "~/bridge/tile/isSameTileLocation";
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

const primaryActionDelayMs = 320;

const unavailableInventoryControl = {
	open: () => false,
} satisfies Pick<InventoryControl, "open">;

const primaryActionKey = (action: useTileActors.Item["primaryAction"]) =>
	action.kind === "start-default-line" ? `${action.kind}:${action.lineId}` : action.kind;

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
	const { geometryVersion, readPlacement } = useTileActorSystem();
	const placement = useMemo(
		() => readPlacement(presentation.canonicalSource),
		[
			geometryVersion,
			presentation.canonicalSource,
			readPlacement,
		],
	);
	const interactive = placement !== null && !itemDetail.isOpen;
	const drag = useTileActorDrag({
		canonicalSource: presentation.canonicalSource,
		live: interactive,
	});
	const pendingPrimaryAction = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestItem = useRef(item);
	latestItem.current = item;

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
						kind: "open-inventory",
					},
					() => {
						inventory.open({
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
			inventory,
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
		item.location,
		item.primaryAction,
		item.revision,
	]);

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
		hovered: presentation.hovered,
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
			onPointerEnter={() => {
				if (interactive) presentation.setHovered(true);
			}}
			onPointerLeave={() => presentation.setHovered(false)}
			onPointerDown={(event) => {
				cancelPendingPrimaryAction();
				drag.onPointerDown(event);
			}}
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
				const scheduledItem = item;
				const scheduledActionKey = primaryActionKey(scheduledItem.primaryAction);
				cancelPendingPrimaryAction();
				pendingPrimaryAction.current = setTimeout(() => {
					pendingPrimaryAction.current = null;
					const currentItem = latestItem.current;
					if (
						currentItem.id !== scheduledItem.id ||
						currentItem.revision !== scheduledItem.revision ||
						!isSameTileLocation(currentItem.location, scheduledItem.location) ||
						primaryActionKey(currentItem.primaryAction) !== scheduledActionKey
					) {
						return;
					}
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
