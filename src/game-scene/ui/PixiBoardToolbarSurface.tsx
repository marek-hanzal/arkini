import { useAtom } from "@effect/atom-react";
import { match } from "ts-pattern";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { useTileCommands } from "~/tile-interaction/ui/useTileCommands";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { TileDefaultLineCommandAtom } from "~/tile-interaction/atom/TileDefaultLineCommandAtom";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { useInventoryShortcutKey } from "~/game-shell/ui/useInventoryShortcutKey";
import type { MainActivationIntent } from "~/tile-interaction/type/MainActivationIntent";
import { createMainRuntimeFx } from "~/game-scene/fx/createMainRuntimeFx";
import { PointerDragThreshold } from "~/ui/constant/PointerDragThreshold";
import { usePixiGameRuntime } from "~/game-scene/ui/PixiGameRuntime";
import type { MainRuntime } from "~/game-scene/service/MainRuntime";

/**
 * Mounts the one Pixi-native Board + Toolbar scene into the React-owned game shell.
 *
 * Left click performs the canonical primary action, Ctrl+left click fills its default-line queue,
 * Shift+left click splits a Board stack, and right click opens Item Detail. React forwards commands
 * and overlay cancellation only; the scene runtime owns pointer and display lifecycle.
 */
interface PixiBoardToolbarSurfaceProps {
	readonly onOpenInventoryFn: () => void | PromiseLike<void>;
}

export const PixiBoardToolbarSurface = ({ onOpenInventoryFn }: PixiBoardToolbarSurfaceProps) => {
	const game = useGameEngine();
	const { runSpaceActivationFn, runDropFn, runSplitFn } = useTileCommands(game);
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const { interaction, textures } = usePixiGameRuntime();
	const [enqueueLineState, enqueueLineFn] = useAtom(TileDefaultLineCommandAtom(game));
	const hostRef = useRef<HTMLDivElement>(null);
	const isInventoryShortcutKeyFn = useInventoryShortcutKey();
	const runtimeRef = useRef<MainRuntime | null>(null);
	const interactionBlockedRef = useRef(false);
	const interactionBlocked = gameMenu.phase !== "closed" || itemDetail.state.phase !== "closed";
	interactionBlockedRef.current = interactionBlocked;
	const controlsRef = useRef({
		itemDetail,
	});
	controlsRef.current = {
		itemDetail,
	};

	const activateFn = useCallback(
		async (item: TileActorItem, intent: MainActivationIntent, origin: HTMLElement) => {
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
				await runSplitFn({
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
				enqueueLineFn({
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
						runSpaceActivationFn({
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
					() => onOpenInventoryFn(),
				)
				.with(
					{
						kind: "enqueue-default-line",
					},
					() => {
						enqueueLineFn({
							kind: "enqueue",
							ownerItemId: item.id,
						});
					},
				)
				.exhaustive();
		},
		[
			enqueueLineFn,
			onOpenInventoryFn,
			runSpaceActivationFn,
			runSplitFn,
		],
	);

	useEffect(() => {
		if (enqueueLineState.kind !== "error") return;
		enqueueLineFn({
			kind: "reset",
		});
	}, [
		enqueueLineFn,
		enqueueLineState,
	]);

	useEffect(() => {
		const openInventoryFromKeyboardFn = (event: KeyboardEvent) => {
			if (event.defaultPrevented || interactionBlocked || !isInventoryShortcutKeyFn(event)) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			void Promise.resolve(onOpenInventoryFn()).catch((cause) => {
				console.error("Inventory failed to open from the Board.", cause);
			});
		};
		window.addEventListener("keydown", openInventoryFromKeyboardFn);
		return () => window.removeEventListener("keydown", openInventoryFromKeyboardFn);
	}, [
		interactionBlocked,
		onOpenInventoryFn,
	]);

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (host === null) return;
		let cancelled = false;
		let runtime: MainRuntime | null = null;
		let unregisterInteractionFn: () => void = () => undefined;
		void RendererRuntime.runPromise(
			createMainRuntimeFx({
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
				RendererRuntime.runSync(
					created.setInteractionBlockedFx(interactionBlockedRef.current),
				);
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
			if (runtimeRef.current === runtime) runtimeRef.current = null;
			if (runtime !== null) {
				void RendererRuntime.runPromise(runtime.closeFx).catch((cause) => {
					console.error("Pixi Board + Toolbar scene failed to close.", cause);
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
