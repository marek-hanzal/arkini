import { useAtomSet } from "@effect/atom-react";
import type { Effect } from "effect";
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

type InventoryRuntime = Effect.Success<ReturnType<typeof createInventoryRuntimeFx>>;

/**
 * Mounts the routed Inventory canvas while React retains page framing and navigation ownership.
 *
 * Ordinary activation releases the canonical Inventory item from the engine-owned physical
 * opener. Space activation instead commits its action before returning to the Board. Right click
 * opens Item Detail and never initiates either command.
 */
export const PixiInventorySurface = ({
	onSpaceActivated,
}: {
	readonly onSpaceActivated: () => void;
}) => {
	const game = useGameEngine();
	const itemDetail = useItemDetailControl();
	const { interaction, textures } = usePixiGameRuntime();
	const releaseInventoryItem = useAtomSet(runInventoryReleaseAtom(game), {
		mode: "promise",
	});
	const runSpaceActivation = useAtomSet(runSpaceActivationAtom(game), {
		mode: "promise",
	});
	const runDrop = useAtomSet(runTileDropAtom(game), {
		mode: "promise",
	});
	const hostRef = useRef<HTMLDivElement>(null);
	const runtimeRef = useRef<InventoryRuntime | null>(null);
	const controlsRef = useRef({
		itemDetail,
		onSpaceActivated,
		releaseInventoryItem,
		runSpaceActivation,
	});
	controlsRef.current = {
		itemDetail,
		onSpaceActivated,
		releaseInventoryItem,
		runSpaceActivation,
	};

	const activate = useCallback(
		(item: TileActorItem, openDetail: boolean, origin: HTMLElement) => {
			const {
				itemDetail: currentItemDetail,
				onSpaceActivated: currentOnSpaceActivated,
				releaseInventoryItem: currentReleaseInventoryItem,
				runSpaceActivation: currentRunSpaceActivation,
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
				return currentRunSpaceActivation({
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
					if (runtimeRef.current === runtime) currentOnSpaceActivated();
				});
			}
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
		let runtime: InventoryRuntime | null = null;
		let unregisterInteraction: () => void = () => undefined;
		void RendererRuntime.runPromise(
			createInventoryRuntimeFx({
				dragThreshold: PointerDragThreshold,
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
				runtimeRef.current = created;
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
				if (runtimeRef.current === runtime) runtimeRef.current = null;
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
