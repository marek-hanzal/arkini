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
import { readPixiMainSceneLayoutFx } from "~/ui/pixi/layout/readPixiMainSceneLayoutFx";
import { usePixiGameRuntime } from "~/ui/pixi/usePixiGameRuntime";

/** Mounts the isolated Inventory Pixi scene inside React-owned modal chrome. */
export const PixiInventorySurface = () => {
	const game = useGameEngine();
	const itemDetail = useItemDetailControl();
	const { handoffs, interaction, textures } = usePixiGameRuntime();
	const releaseInventoryItem = useAtomSet(runInventoryReleaseAtom(game), {
		mode: "promise",
	});
	const runDrop = useAtomSet(runTileDropAtom(game), {
		mode: "promise",
	});
	const hostRef = useRef<HTMLDivElement>(null);
	const controlsRef = useRef({
		handoffs,
		itemDetail,
		releaseInventoryItem,
	});
	controlsRef.current = {
		handoffs,
		itemDetail,
		releaseInventoryItem,
	};

	const activate = useCallback(
		(
			item: TileActorItem,
			shiftKey: boolean,
			origin: HTMLElement,
			handoff: {
				readonly centerX: number;
				readonly centerY: number;
				readonly size: number;
			},
		) => {
			const {
				handoffs: currentHandoffs,
				itemDetail: currentItemDetail,
				releaseInventoryItem: currentReleaseInventoryItem,
			} = controlsRef.current;
			if (shiftKey) {
				RendererRuntime.runSync(
					currentItemDetail.openItemDetailFx({
						itemId: item.id,
						origin,
					}),
				);
				return;
			}
			if (item.location.scope !== LocationScopeEnumSchema.enum.Inventory) return;
			RendererRuntime.runSync(
				currentHandoffs.writeFx(item.id, {
					...handoff,
				}),
			);
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
		const tileScene = host.closest<HTMLElement>('[data-ui="TileScene"]');
		const mainLayout = RendererRuntime.runSync(
			readPixiMainSceneLayoutFx({
				boardHeight: game.config.meta.board.height,
				boardWidth: game.config.meta.board.width,
				height: Math.max(
					1,
					tileScene?.clientHeight ?? document.documentElement.clientHeight,
				),
				toolbarSize: game.config.meta.toolbarSize ?? 0,
				width: Math.max(1, tileScene?.clientWidth ?? document.documentElement.clientWidth),
			}),
		);
		host.style.minWidth = `${mainLayout.board.cellSize * game.config.meta.inventory.width}px`;
		host.style.minHeight = `${mainLayout.board.cellSize * game.config.meta.inventory.height}px`;
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
				console.error("Pixi Inventory scene failed to initialize.", cause);
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
		/>
	);
};
