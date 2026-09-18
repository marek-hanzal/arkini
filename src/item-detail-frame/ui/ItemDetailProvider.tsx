import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
	type PropsWithChildren,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import { resolveItemDetailTargetFn } from "~/item-detail-read/fn/resolveItemDetailTargetFn";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { createItemDetailControllerFx } from "~/item-detail-frame/fx/createItemDetailControllerFx";
import { ItemDetailContext } from "~/item-detail-frame/context/ItemDetailContext";
import type { ItemDetailControl } from "~/item-detail-frame/type/ItemDetailControl";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useGameAudioControl } from "~/game-audio/ui/useGameAudioControl";
import { useItemDetailMusic } from "~/item-detail-frame/ui/useItemDetailMusic";
import { PresentationSfxEventEnumSchema } from "~/sfx-event/schema/PresentationSfxEventEnumSchema";

/**
 * Game-shell owner for one exact Item Detail target and modal lifecycle.
 * Engine-backed resolvers remain authoritative for
 * target availability; the fixed presentation tabs do not retain or manufacture
 * gameplay facts when a runtime item or configured definition disappears.
 *
 * Gesture semantics are decided by the invoking surface: right click opens
 * Detail and suppresses the immediate primary action. The provider receives only
 * the resulting open intent, so no click timers or double-click policy belong
 * here.
 */
export const ItemDetailProvider = ({
	children,
	game,
}: PropsWithChildren<{
	readonly game: GameEngine;
}>) => {
	const { playSfxEventFn } = useGameAudioControl();
	const [controller] = useState(() => RendererRuntime.runSync(createItemDetailControllerFx()));
	const openTargetFx = useCallback(
		(target: ItemDetailTarget) =>
			Effect.gen(function* () {
				const phase = controller.getSnapshotFn().phase;
				const opened = yield* controller.openTargetFx(target);
				if (opened && (phase === "closed" || phase === "exiting")) {
					playSfxEventFn(PresentationSfxEventEnumSchema.enum.ItemDetailOpened);
				}
				return opened;
			}),
		[
			controller,
			playSfxEventFn,
		],
	);
	const closeFx = useCallback(
		(props?: Parameters<typeof controller.closeFx>[0]) =>
			Effect.suspend(() => {
				const phase = controller.getSnapshotFn().phase;
				if (phase !== "closed" && phase !== "exiting") {
					playSfxEventFn(PresentationSfxEventEnumSchema.enum.ItemDetailClosed);
				}
				return controller.closeFx(props);
			}),
		[
			controller,
			playSfxEventFn,
		],
	);
	const closeAtom = useMemo(
		() =>
			Atom.fn((props: Parameters<typeof closeFx>[0]) => closeFx(props), {
				concurrent: true,
			}).pipe(Atom.setIdleTTL(0)),
		[
			closeFx,
		],
	);
	const [closeResult, closeFn] = useAtom(closeAtom);
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(closeResult));
	const snapshot = useSyncExternalStore(
		controller.subscribeFn,
		controller.getSnapshotFn,
		controller.getSnapshotFn,
	);
	useItemDetailMusic(game, snapshot);

	const openItemDetailFx = useCallback(
		({ itemId, tab, origin = null }: Parameters<ItemDetailControl["openItemDetailFx"]>[0]) =>
			Effect.suspend(() => {
				const runtime = game.getSnapshotFn();
				const resolved = resolveItemDetailTargetFn({
					itemId,
					requestedTab: tab,
					runtime,
				});
				if (resolved.kind === "unavailable") return Effect.succeed(false);
				return openTargetFx({
					kind: "runtime",
					itemId: resolved.itemId,
					tab: resolved.tab,
					origin: controller.readOriginFn(origin),
				});
			}),
		[
			game,
			openTargetFx,
		],
	);

	const openItemDefinitionDetailFx = useCallback(
		({
			itemId,
			origin = null,
			tab = "info",
		}: Parameters<ItemDetailControl["openItemDefinitionDetailFx"]>[0]) =>
			Effect.suspend(() => {
				if (game.config.items[itemId] === undefined) return Effect.succeed(false);
				return openTargetFx({
					kind: "definition",
					itemId,
					tab,
					origin: controller.readOriginFn(origin),
				});
			}),
		[
			game,
			openTargetFx,
		],
	);

	const selectRetainedItemDetailTabFx = useCallback(
		({
			kind,
			itemId,
			tab,
		}: Parameters<ItemDetailControl["selectRetainedItemDetailTabFx"]>[0]) =>
			Effect.suspend(() => {
				const current = controller.getSnapshotFn();
				if (
					current.phase === "closed" ||
					current.phase === "exiting" ||
					current.target.kind !== kind ||
					current.target.itemId !== itemId
				) {
					return Effect.succeed(false);
				}
				return controller.openTargetFx({
					...current.target,
					tab,
				});
			}),
		[
			controller,
		],
	);

	useEffect(() => {
		const onKeyDownFn = (event: KeyboardEvent) => {
			const current = controller.getSnapshotFn();
			if (event.key !== "Escape" || current.phase === "closed") return;
			event.preventDefault();
			event.stopPropagation();
			if (current.phase !== "exiting") {
				closeFn(undefined);
			}
		};
		window.addEventListener("keydown", onKeyDownFn, true);
		return () => window.removeEventListener("keydown", onKeyDownFn, true);
	}, [
		controller,
		closeFn,
	]);

	useEffect(
		() => () => {
			RendererRuntime.runSync(controller.resetFx);
		},
		[
			controller,
		],
	);

	const control = useMemo<ItemDetailControl>(
		() => ({
			state: snapshot,
			openItemDetailFx,
			openItemDefinitionDetailFx,
			selectRetainedItemDetailTabFx,
			closeAtom,
			closeFx,
			completeEnterFx: controller.completeEnterFx,
			completeExitFx: controller.completeExitFx,
		}),
		[
			closeAtom,
			closeFx,
			controller,
			openItemDefinitionDetailFx,
			openItemDetailFx,
			selectRetainedItemDetailTabFx,
			snapshot,
		],
	);

	return <ItemDetailContext.Provider value={control}>{children}</ItemDetailContext.Provider>;
};
