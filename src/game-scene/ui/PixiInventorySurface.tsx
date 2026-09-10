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
 * Ordinary activation releases the canonical Inventory item from the engine-owned physical
 * opener. Space activation instead commits its action before returning to the Board. Right click
 * opens Item Detail and never initiates either command.
 */
export const PixiInventorySurface = ({
	onSpaceActivatedFn,
}: {
	readonly onSpaceActivatedFn: () => void;
}) => {
	const game = useGameEngine();
	const { releaseInventoryItemFn, runSpaceActivationFn, runDropFn } = useTileCommands(game);
	const itemDetail = useItemDetailControl();
	const { textures } = usePixiGameRuntime();
	const controlsRef = useRef({
		itemDetail,
		onSpaceActivatedFn,
		releaseInventoryItemFn,
		runSpaceActivationFn,
	});
	controlsRef.current = {
		itemDetail,
		onSpaceActivatedFn,
		releaseInventoryItemFn,
		runSpaceActivationFn,
	};

	const activateFn = useCallback(
		(item: TileActorItem, openDetail: boolean, origin: HTMLElement) => {
			const {
				itemDetail: currentItemDetail,
				onSpaceActivatedFn: currentOnSpaceActivatedFn,
				releaseInventoryItemFn: currentReleaseInventoryItemFn,
				runSpaceActivationFn: currentRunSpaceActivationFn,
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
			if (item.primaryAction.kind === "activate-space") {
				const runtime = runtimeRef.current;
				if (runtime === null) return;
				return currentRunSpaceActivationFn({
					currentSpace: item.primaryAction.currentSpace,
					itemId: item.id,
					location: item.location,
					revision: item.revision,
				}).then(async (result) => {
					if (result === null || runtimeRef.current !== runtime) return;
					if (result.transition !== null) {
						await RendererRuntime.runPromise(
							runtime.projectSpaceActivationFx(result.transition),
						);
					}
					if (runtimeRef.current === runtime) currentOnSpaceActivatedFn();
				});
			}
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
	const { hostRef, runtimeRef } = useBoardRuntime({
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
