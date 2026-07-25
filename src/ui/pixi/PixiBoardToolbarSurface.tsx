import { useAtom, useAtomSet } from "@effect/atom-react";
import { match } from "ts-pattern";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { TileDefaultLineCommandAtom } from "~/bridge/tile/TileDefaultLineCommandAtom";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useInventoryControl } from "~/ui/inventory/useInventoryControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import type { PixiMainSceneRuntime } from "~/ui/pixi/scene/PixiMainSceneRuntime";
import { createPixiMainSceneRuntimeFx } from "~/ui/pixi/scene/createPixiMainSceneRuntimeFx";
import { usePixiGameRuntime } from "~/ui/pixi/usePixiGameRuntime";

/** Mounts the one Pixi-native Board + Toolbar scene into the React game shell. */
export const PixiBoardToolbarSurface = () => {
	const game = useGameEngine();
	const gameMenu = useGameMenuControl();
	const inventory = useInventoryControl();
	const itemDetail = useItemDetailControl();
	const { handoffs, interaction, textures } = usePixiGameRuntime();
	const [startLineState, runStartLine] = useAtom(TileDefaultLineCommandAtom(game));
	const runDrop = useAtomSet(runTileDropAtom(game), {
		mode: "promise",
	});
	const hostRef = useRef<HTMLDivElement>(null);
	const semanticHostRef = useRef<HTMLDivElement>(null);
	const runtimeRef = useRef<PixiMainSceneRuntime | null>(null);
	const interactionBlockedRef = useRef(false);
	const interactionBlocked = gameMenu.isOpen || inventory.isOpen || itemDetail.isOpen;
	interactionBlockedRef.current = interactionBlocked;
	const controlsRef = useRef({
		inventory,
		itemDetail,
	});
	controlsRef.current = {
		inventory,
		itemDetail,
	};

	const openLines = useCallback((itemId: string, origin: HTMLElement) => {
		RendererRuntime.runSync(
			controlsRef.current.itemDetail.openItemDetailFx({
				itemId,
				origin,
				tab: "lines",
			}),
		);
	}, []);

	const activate = useCallback(
		async (item: TileActorItem, shiftKey: boolean, origin: HTMLElement) => {
			const { inventory: currentInventory, itemDetail: currentItemDetail } =
				controlsRef.current;
			if (shiftKey) {
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
						kind: "open-lines",
					},
					() => {
						openLines(item.id, origin);
						return Promise.resolve();
					},
				)
				.with(
					{
						kind: "open-inventory",
					},
					() =>
						RendererRuntime.runPromise(
							currentInventory.openFx({
								origin,
							}),
						).then(() => undefined),
				)
				.with(
					{
						kind: "start-default-line",
					},
					({ lineId }) => {
						if (item.running) {
							openLines(item.id, origin);
							return;
						}
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
			openLines,
			runStartLine,
		],
	);

	useEffect(() => {
		if (startLineState.kind !== "error") return;
		const origin = runtimeRef.current?.canvas ?? hostRef.current;
		if (origin !== null) openLines(startLineState.ownerItemId, origin);
		runStartLine({
			kind: "reset",
		});
	}, [
		openLines,
		runStartLine,
		startLineState,
	]);

	useLayoutEffect(() => {
		const host = hostRef.current;
		const semanticHost = semanticHostRef.current;
		if (host === null || semanticHost === null) return;
		let cancelled = false;
		let runtime: PixiMainSceneRuntime | null = null;
		let unregisterInteraction: () => void = () => undefined;
		void RendererRuntime.runPromise(
			createPixiMainSceneRuntimeFx({
				game,
				handoffs,
				host,
				onActivate: activate,
				onDrop: runDrop,
				semanticHost,
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
				console.error("Pixi Board + Toolbar scene failed to initialize.", cause);
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
		handoffs,
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
		<>
			<div
				ref={hostRef}
				className="size-full min-h-0 min-w-0"
				data-ui="PixiBoardToolbarSurface"
			/>
			<div
				ref={semanticHostRef}
				aria-label="Visible Board and Toolbar items"
				className="sr-only"
				data-ui="PixiBoardToolbarSemantics"
				role="region"
			/>
		</>
	);
};
