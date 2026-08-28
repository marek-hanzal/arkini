import { useAtom, useAtomSet } from "@effect/atom-react";
import { match } from "ts-pattern";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { runSpaceActivationAtom } from "~/bridge/space/runSpaceActivationAtom";
import { TileDefaultLineCommandAtom } from "~/bridge/tile/TileDefaultLineCommandAtom";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import { runTileSplitAtom } from "~/bridge/tile/runTileSplitAtom";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { useInventoryShortcutKey } from "~/ui/navigation/useInventoryShortcutKey";
import type { PixiMainSceneRuntime } from "~/ui/pixi/scene/PixiMainSceneRuntime";
import type { PixiMainSceneActivationIntent } from "~/ui/pixi/scene/PixiMainSceneActivationIntent";
import { createMainRuntimeFx } from "~/ui/pixi/scene/createMainRuntimeFx";
import { usePixiGameRuntime } from "~/ui/pixi/usePixiGameRuntime";

/**
 * Mounts the one Pixi-native Board + Toolbar scene into the React-owned game shell.
 *
 * Left click performs the canonical primary action, Ctrl+left click fills its default-line queue,
 * Shift+left click splits a Board stack, and right click opens Item Detail. React forwards commands
 * and overlay cancellation only; the scene runtime owns pointer and display lifecycle.
 */
export namespace PixiBoardToolbarSurface {
	export interface Props {
		readonly onOpenInventory: () => void | PromiseLike<void>;
	}
}

export const PixiBoardToolbarSurface = ({ onOpenInventory }: PixiBoardToolbarSurface.Props) => {
	const game = useGameEngine();
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const { interaction, textures } = usePixiGameRuntime();
	const [enqueueLineState, enqueueLine] = useAtom(TileDefaultLineCommandAtom(game));
	const runDrop = useAtomSet(runTileDropAtom(game), {
		mode: "promise",
	});
	const runSplit = useAtomSet(runTileSplitAtom(game), {
		mode: "promise",
	});
	const runSpaceActivation = useAtomSet(runSpaceActivationAtom(game), {
		mode: "promise",
	});
	const hostRef = useRef<HTMLDivElement>(null);
	const isInventoryShortcutKey = useInventoryShortcutKey();
	const runtimeRef = useRef<PixiMainSceneRuntime | null>(null);
	const interactionBlockedRef = useRef(false);
	const interactionBlocked = gameMenu.isOpen || itemDetail.isOpen;
	interactionBlockedRef.current = interactionBlocked;
	const controlsRef = useRef({
		itemDetail,
	});
	controlsRef.current = {
		itemDetail,
	};

	const activate = useCallback(
		async (item: TileActorItem, intent: PixiMainSceneActivationIntent, origin: HTMLElement) => {
			const { itemDetail: currentItemDetail } = controlsRef.current;
			if (intent === "detail") {
				RendererRuntime.runSync(
					currentItemDetail.openItemDetailFx({
						itemId: item.id,
						origin,
					}),
				);
				return;
			}
			if (intent === "split-stack") {
				if (item.location.scope !== "board" || item.quantity < 2) return;
				await runSplit({
					itemId: item.id,
					location: item.location,
					revision: item.revision,
				});
				return;
			}
			if (intent === "fill-default-line-queue") {
				if (
					item.location.scope !== "board" ||
					item.primaryAction.kind !== "enqueue-default-line"
				) {
					return;
				}
				enqueueLine({
					kind: "fill",
					ownerItemId: item.id,
				});
				return;
			}
			await match(item.primaryAction)
				.with(
					{
						kind: "none",
					},
					() => Promise.resolve(),
				)
				.with(
					{
						kind: "activate-space",
					},
					(primaryAction) =>
						runSpaceActivation({
							currentSpace: primaryAction.currentSpace,
							itemId: item.id,
							location: item.location,
							revision: item.revision,
						}),
				)
				.with(
					{
						kind: "open-inventory",
					},
					() => onOpenInventory(),
				)
				.with(
					{
						kind: "enqueue-default-line",
					},
					() => {
						enqueueLine({
							kind: "enqueue",
							ownerItemId: item.id,
						});
					},
				)
				.exhaustive();
		},
		[
			enqueueLine,
			onOpenInventory,
			runSpaceActivation,
			runSplit,
		],
	);

	useEffect(() => {
		if (enqueueLineState.kind !== "error") return;
		enqueueLine({
			kind: "reset",
		});
	}, [
		enqueueLine,
		enqueueLineState,
	]);

	useEffect(() => {
		const openInventoryFromKeyboard = (event: KeyboardEvent) => {
			if (event.defaultPrevented || interactionBlocked || !isInventoryShortcutKey(event)) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			void Promise.resolve(onOpenInventory()).catch((cause) => {
				console.error("Inventory failed to open from the Board.", cause);
			});
		};
		window.addEventListener("keydown", openInventoryFromKeyboard);
		return () => window.removeEventListener("keydown", openInventoryFromKeyboard);
	}, [
		interactionBlocked,
		onOpenInventory,
	]);

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (host === null) return;
		let cancelled = false;
		let runtime: PixiMainSceneRuntime | null = null;
		let unregisterInteraction: () => void = () => undefined;
		void RendererRuntime.runPromise(
			createMainRuntimeFx({
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
				RendererRuntime.runSync(
					created.setInteractionBlockedFx(interactionBlockedRef.current),
				);
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
			if (runtimeRef.current === runtime) runtimeRef.current = null;
			if (runtime !== null) {
				void RendererRuntime.runPromise(runtime.closeFx).catch((cause) => {
					console.error("Pixi Board + Toolbar scene failed to close.", cause);
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

	useEffect(() => {
		const runtime = runtimeRef.current;
		if (runtime !== null) {
			RendererRuntime.runSync(runtime.setInteractionBlockedFx(interactionBlocked));
		}
	}, [
		interactionBlocked,
	]);

	return (
		<div
			ref={hostRef}
			className="size-full min-h-0 min-w-0"
			data-ui="PixiBoardToolbarSurface"
			onContextMenu={(event) => event.preventDefault()}
		/>
	);
};
