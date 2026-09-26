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

// Cover the Board's exit, render barrier and arrival before fading its overlay.
const boardChangeDetailExitDelayMs = 360;

/**
 * Game-shell owner for one exact Item Detail target and modal lifecycle.
 * Engine-backed resolvers remain authoritative for
 * target availability; the modal does not manufacture
 * gameplay facts when a runtime item or configured definition disappears.
 *
 * Gesture semantics are decided by the invoking surface. The provider receives only
 * the resulting open intent after any Board action, so no click timers or
 * double-click policy belong here.
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
	useEffect(() => {
		let observedSpace = game.getSnapshotFn().currentSpace;
		return game.subscribeTransitionsFn((transition) => {
			const nextSpace = transition.runtime.currentSpace;
			const spaceChanged = nextSpace !== observedSpace;
			observedSpace = nextSpace;
			const currentBoardReset = transition.events.some(
				(event) => event.type === "board:template-applied" && event.space === nextSpace,
			);
			if (!spaceChanged && !currentBoardReset) return;
			if (controller.getSnapshotFn().phase !== "closed")
				closeFn({
					restoreFocus: false,
					exitDelayMs: boardChangeDetailExitDelayMs,
				});
		});
	}, [
		game,
		controller,
		closeFn,
	]);
	const snapshot = useSyncExternalStore(
		controller.subscribeFn,
		controller.getSnapshotFn,
		controller.getSnapshotFn,
	);
	useItemDetailMusic(game, snapshot);

	const openItemDetailFx = useCallback(
		({ itemId, origin = null }: Parameters<ItemDetailControl["openItemDetailFx"]>[0]) =>
			Effect.suspend(() => {
				const runtime = game.getSnapshotFn();
				const resolved = resolveItemDetailTargetFn({
					itemId,
					runtime,
				});
				if (resolved.kind === "unavailable") return Effect.succeed(false);
				return openTargetFx({
					kind: "runtime",
					itemId: resolved.itemId,
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
			itemUid,
			origin = null,
		}: Parameters<ItemDetailControl["openItemDefinitionDetailFx"]>[0]) =>
			Effect.suspend(() => {
				const item = game.config.items[itemUid];
				if (item === undefined) return Effect.succeed(false);
				return openTargetFx({
					kind: "definition",
					itemUid,
					origin: controller.readOriginFn(origin),
				});
			}),
		[
			game,
			openTargetFx,
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
			snapshot,
		],
	);

	return <ItemDetailContext.Provider value={control}>{children}</ItemDetailContext.Provider>;
};
