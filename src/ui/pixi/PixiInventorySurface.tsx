import { useAtomSet } from "@effect/atom-react";
import { useCallback, useLayoutEffect, useRef } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { runInventoryReleaseAtom } from "~/bridge/inventory/runInventoryReleaseAtom";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import type { PixiInventorySceneRuntime } from "~/ui/pixi/scene/PixiInventorySceneRuntime";
import { createPixiInventorySceneRuntimeFx } from "~/ui/pixi/scene/createPixiInventorySceneRuntimeFx";
import { usePixiGameRuntime } from "~/ui/pixi/usePixiGameRuntime";

/**
 * Mounts the routed Inventory canvas while React retains page framing and navigation ownership.
 *
 * Ordinary activation releases the canonical Inventory item from the engine-owned physical
 * opener. Right click opens Item Detail and never initiates a release.
 */
export const PixiInventorySurface = () => {
	const game = useGameEngine();
	const itemDetail = useItemDetailControl();
	const { interaction, textures } = usePixiGameRuntime();
	const releaseInventoryItem = useAtomSet(runInventoryReleaseAtom(game), {
		mode: "promise",
	});
	const runDrop = useAtomSet(runTileDropAtom(game), {
		mode: "promise",
	});
	const hostRef = useRef<HTMLDivElement>(null);
	const controlsRef = useRef({
		itemDetail,
		releaseInventoryItem,
	});
	controlsRef.current = {
		itemDetail,
		releaseInventoryItem,
	};

	const activate = useCallback(
		(item: TileActorItem, openDetail: boolean, origin: HTMLElement) => {
			const {
				itemDetail: currentItemDetail,
				releaseInventoryItem: currentReleaseInventoryItem,
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
			return currentReleaseInventoryItem({
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
		let runtime: PixiInventorySceneRuntime | null = null;
		let unregisterInteraction: () => void = () => undefined;
		void RendererRuntime.runPromise(
			createPixiInventorySceneRuntimeFx({
				game,
				host,
				onActivate: activate,
				onDrop: runDrop,
				textures,
			}),
		)
			.then((created) => {
				if (cancelled) {
					return RendererRuntime.runPromise(created.closeFx);
				}
				runtime = created;
				unregisterInteraction = RendererRuntime.runSync(
					interaction.registerFx(() =>
						RendererRuntime.runSync(created.cancelInteractionFx),
					),
				);
			})
			.catch((cause) => {
				if (cancelled) return;
				game.reportCriticalFailure("game-presentation", cause);
			});
		return () => {
			cancelled = true;
			unregisterInteraction();
			if (runtime !== null) {
				void RendererRuntime.runPromise(runtime.closeFx).catch((cause) => {
					console.error("Pixi Inventory scene failed to close.", cause);
				});
			}
		};
	}, [
		activate,
		game,
		interaction,
		runDrop,
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
