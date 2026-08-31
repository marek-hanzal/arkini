import { useAtomSet } from "@effect/atom-react";
import { useCallback, useLayoutEffect, useRef } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { runInventoryReleaseAtom } from "~/tile-interaction/atom/runInventoryReleaseAtom";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { runSpaceActivationAtom } from "~/tile-interaction/atom/runSpaceActivationAtom";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { runTileDropAtom } from "~/tile-interaction/atom/runTileDropAtom";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { createInventoryRuntimeFx } from "~/game-scene/fx/createInventoryRuntimeFx";
import { PointerDragThreshold } from "~/ui/constant/PointerDragThreshold";
import { usePixiGameRuntime } from "~/game-scene/ui/PixiGameRuntime";
import type { InventoryRuntime } from "~/game-scene/service/InventoryRuntime";

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
	const itemDetail = useItemDetailControl();
	const { interaction, textures } = usePixiGameRuntime();
	const releaseInventoryItemFn = useAtomSet(runInventoryReleaseAtom(game), {
		mode: "promise",
	});
	const runSpaceActivationFn = useAtomSet(runSpaceActivationAtom(game), {
		mode: "promise",
	});
	const runDropFn = useAtomSet(runTileDropAtom(game), {
		mode: "promise",
	});
	const hostRef = useRef<HTMLDivElement>(null);
	const runtimeRef = useRef<InventoryRuntime | null>(null);
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

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (host === null) return;
		let cancelled = false;
		let runtime: InventoryRuntime | null = null;
		let unregisterInteractionFn: () => void = () => undefined;
		void RendererRuntime.runPromise(
			createInventoryRuntimeFx({
				dragThreshold: PointerDragThreshold,
				game,
				host,
				onActivateFn: activateFn,
				onDropFn: runDropFn,
				textures,
			}),
		)
			.then((created) => {
				if (cancelled) {
					return RendererRuntime.runPromise(created.closeFx);
				}
				runtime = created;
				runtimeRef.current = created;
				unregisterInteractionFn = RendererRuntime.runSync(
					interaction.registerFx(() =>
						RendererRuntime.runSync(created.cancelInteractionFx),
					),
				);
			})
			.catch((cause) => {
				if (cancelled) return;
				game.reportCriticalFailureFn("game-presentation", cause);
			});
		return () => {
			cancelled = true;
			unregisterInteractionFn();
			if (runtime !== null) {
				if (runtimeRef.current === runtime) runtimeRef.current = null;
				void RendererRuntime.runPromise(runtime.closeFx).catch((cause) => {
					console.error("Pixi Inventory scene failed to close.", cause);
				});
			}
		};
	}, [
		activateFn,
		game,
		interaction,
		runDropFn,
		textures,
	]);

	return (
		<div
			ref={hostRef}
			className="size-full min-h-0 min-w-0"
			data-ui="PixiInventorySurface"
			onContextMenu={(event) => event.preventDefault()}
		/>
	);
};
