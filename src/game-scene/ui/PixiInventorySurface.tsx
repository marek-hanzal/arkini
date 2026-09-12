import { useCallback, useRef } from "react";

import { useTileCommands } from "~/tile-interaction/ui/useTileCommands";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { useBoardRuntime } from "~/game-scene/ui/useBoardRuntime";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { createInventoryRuntimeFx } from "~/game-scene/fx/createInventoryRuntimeFx";
import { PointerDragThreshold } from "~/ui/constant/PointerDragThreshold";
import { usePixiGameRuntime } from "~/game-scene/ui/PixiGameRuntime";

/**
 * Mounts the routed Inventory canvas while React retains page framing and navigation ownership.
 *
 * Ordinary activation releases the canonical Inventory item to the current Board or Toolbar. Right click opens Item Detail and never initiates the release command.
 */
export const PixiInventorySurface = () => {
	const game = useGameEngine();
	const { releaseInventoryItemFn, runDropFn } = useTileCommands(game);
	const itemDetail = useItemDetailControl();
	const { textures } = usePixiGameRuntime();
	const controlsRef = useRef({
		itemDetail,
		releaseInventoryItemFn,
	});
	controlsRef.current = {
		itemDetail,
		releaseInventoryItemFn,
	};

	const activateFn = useCallback(
		(item: TileActorItem, openDetail: boolean, origin: HTMLElement) => {
			const {
				itemDetail: currentItemDetail,
				releaseInventoryItemFn: currentReleaseInventoryItemFn,
			} = controlsRef.current;
			if (openDetail) {
				RendererRuntime.runSync(
					currentItemDetail.openItemDetailFx({
						itemId: item.id,
						origin,
					}),
				);
				return;
			}
			if (item.location.scope !== LocationScopeEnumSchema.enum.Inventory) return;
			return currentReleaseInventoryItemFn({
				itemId: item.id,
				location: item.location,
				revision: item.revision,
			});
		},
		[],
	);

	const createRuntimeFx = useCallback(
		(host: HTMLElement) =>
			createInventoryRuntimeFx({
				dragThreshold: PointerDragThreshold,
				game,
				host,
				onActivateFn: activateFn,
				onDropFn: runDropFn,
				textures,
			}),
		[
			activateFn,
			game,
			runDropFn,
			textures,
		],
	);
	const { hostRef } = useBoardRuntime({
		createRuntimeFx,
		game,
	});

	return (
		<div
			ref={hostRef}
			className="size-full min-h-0 min-w-0"
			data-ui="PixiInventorySurface"
			onContextMenu={(event) => event.preventDefault()}
		/>
	);
};
