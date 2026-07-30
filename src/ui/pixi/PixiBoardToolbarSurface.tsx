import { useAtom, useAtomSet } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { match } from "ts-pattern";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { TileDefaultLineCommandAtom } from "~/bridge/tile/TileDefaultLineCommandAtom";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import { runTileSplitAtom } from "~/bridge/tile/runTileSplitAtom";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { isInventoryShortcutKey } from "~/ui/navigation/isInventoryShortcutKey";
import type { PixiMainSceneRuntime } from "~/ui/pixi/scene/PixiMainSceneRuntime";
import type { PixiMainSceneActivationIntent } from "~/ui/pixi/scene/PixiMainSceneActivationIntent";
import { createPixiMainSceneRuntimeFx } from "~/ui/pixi/scene/createPixiMainSceneRuntimeFx";
import { usePixiGameRuntime } from "~/ui/pixi/usePixiGameRuntime";

/**
 * Mounts the one Pixi-native Board + Toolbar scene into the React-owned game shell.
 *
 * Left click performs the canonical primary action, Ctrl+left click fills its default-line queue,
 * Shift+left click splits a Board stack, and right click opens Item Detail. React forwards commands
 * and overlay cancellation only; the scene runtime owns pointer and display lifecycle.
 */
export const PixiBoardToolbarSurface = () => {
	const game = useGameEngine();
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const navigate = useNavigate();
	const { interaction, textures } = usePixiGameRuntime();
	const [enqueueLineState, enqueueLine] = useAtom(TileDefaultLineCommandAtom(game));
	const runDrop = useAtomSet(runTileDropAtom(game), {
		mode: "promise",
	});
	const runSplit = useAtomSet(runTileSplitAtom(game), {
		mode: "promise",
	});
	const hostRef = useRef<HTMLDivElement>(null);
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

	const openInventory = useCallback(
		() =>
			navigate({
				to: "/game/$packageId/inventory",
				params: {
					packageId: game.arkpack.packageId,
				},
			}).then(() => undefined),
		[
			game.arkpack.packageId,
			navigate,
		],
	);

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
						kind: "open-inventory",
					},
					() => openInventory(),
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
			openInventory,
			enqueueLine,
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
			void openInventory().catch((cause) => {
				console.error("Inventory failed to open from the Board.", cause);
			});
		};
		window.addEventListener("keydown", openInventoryFromKeyboard);
		return () => window.removeEventListener("keydown", openInventoryFromKeyboard);
	}, [
		interactionBlocked,
		openInventory,
	]);

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (host === null) return;
		let cancelled = false;
		let runtime: PixiMainSceneRuntime | null = null;
		let unregisterInteraction: () => void = () => undefined;
		void RendererRuntime.runPromise(
			createPixiMainSceneRuntimeFx({
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
