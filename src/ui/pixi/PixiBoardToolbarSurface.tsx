import { useAtom, useAtomSet } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { match } from "ts-pattern";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { TileDefaultLineCommandAtom } from "~/bridge/tile/TileDefaultLineCommandAtom";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import type { PixiMainSceneRuntime } from "~/ui/pixi/scene/PixiMainSceneRuntime";
import { createPixiMainSceneRuntimeFx } from "~/ui/pixi/scene/createPixiMainSceneRuntimeFx";
import { usePixiGameRuntime } from "~/ui/pixi/usePixiGameRuntime";

/**
 * Mounts the one Pixi-native Board + Toolbar scene into the React-owned game shell.
 *
 * Left click performs the canonical primary action and right click opens Item Detail. React forwards
 * commands and overlay cancellation only; the scene runtime owns pointer and display lifecycle.
 */
export const PixiBoardToolbarSurface = () => {
	const game = useGameEngine();
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const navigate = useNavigate();
	const { interaction, textures } = usePixiGameRuntime();
	const [startLineState, runStartLine] = useAtom(TileDefaultLineCommandAtom(game));
	const runDrop = useAtomSet(runTileDropAtom(game), {
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
		async (item: TileActorItem, openDetail: boolean, origin: HTMLElement) => {
			const { itemDetail: currentItemDetail } = controlsRef.current;
			if (openDetail) {
				RendererRuntime.runSync(
					currentItemDetail.openItemDetailFx({
						itemId: item.id,
						origin,
					}),
				);
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
						kind: "start-default-line",
					},
					({ lineId }) => {
						runStartLine({
							kind: "start",
							lineId,
							ownerItemId: item.id,
						});
					},
				)
				.exhaustive();
		},
		[
			openInventory,
			runStartLine,
		],
	);

	useEffect(() => {
		if (startLineState.kind !== "error") return;
		runStartLine({
			kind: "reset",
		});
	}, [
		runStartLine,
		startLineState,
	]);

	useEffect(() => {
		const openInventoryFromKeyboard = (event: KeyboardEvent) => {
			const target = event.target;
			if (
				event.defaultPrevented ||
				event.repeat ||
				event.key.toLowerCase() !== "i" ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				interactionBlocked ||
				(target instanceof HTMLElement &&
					(target.isContentEditable ||
						target.tagName === "INPUT" ||
						target.tagName === "SELECT" ||
						target.tagName === "TEXTAREA"))
			) {
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
