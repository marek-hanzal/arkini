import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import {
	type PropsWithChildren,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { RunItemDetailPendingActionProps } from "~/ui/item-detail/ItemDetailPendingActionOwner";
import { createItemDetailCommandAtom } from "~/ui/item-detail/createItemDetailCommandAtom";
import { useResolveItemDefinitionDetailTarget } from "~/ui/item-detail/useResolveItemDefinitionDetailTarget";
import { useResolveItemDetailTarget } from "~/ui/item-detail/useResolveItemDetailTarget";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { createItemDetailControllerFx } from "~/ui/item-detail/createItemDetailControllerFx";
import { ItemDetailContext } from "~/ui/item-detail/ItemDetailContext";
import type {
	ItemDetailControl,
	OpenItemDefinitionDetailProps,
	OpenItemDetailProps,
	SelectRetainedItemDetailTabProps,
} from "~/ui/item-detail/ItemDetailControl";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";

/**
 * Game-shell owner for one exact Item Detail target, modal lifecycle and
 * command-presentation settlement. Engine-backed resolvers remain authoritative for
 * target availability and allowed tabs; this provider must not retain or
 * manufacture gameplay facts when a runtime item disappears.
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
	const resolveDefinitionTarget = useResolveItemDefinitionDetailTarget();
	const resolveTarget = useResolveItemDetailTarget();
	const [controller] = useState(() => RendererRuntime.runSync(createItemDetailControllerFx()));
	const commandAtom = useMemo(
		() =>
			createItemDetailCommandAtom({
				game,
				readOutcomeScope: controller.readOutcomeScope,
			}),
		[
			controller,
			game,
		],
	);
	const [commandState, writeCommand] = useAtom(commandAtom);
	const runPendingAction = useCallback(
		<Result, Failure>(command: RunItemDetailPendingActionProps<Result, Failure>) =>
			writeCommand(command),
		[
			writeCommand,
		],
	);
	const [closeResult, close] = useAtom(controller.closeAtom);
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(closeResult));
	const snapshot = useSyncExternalStore(
		controller.subscribe,
		controller.getSnapshot,
		controller.getSnapshot,
	);

	useEffect(() => {
		writeCommand({
			kind: "scope-changed",
			outcomeScope: controller.readOutcomeScope(),
		});
	}, [
		controller,
		snapshot.state,
		writeCommand,
	]);

	const openItemDetailFx = useCallback(
		({ itemId, linesSearchQuery, tab, origin = null }: OpenItemDetailProps) =>
			Effect.suspend(() => {
				const resolved = resolveTarget({
					itemId,
					requestedTab: tab,
				});
				if (resolved.kind === "unavailable") return Effect.succeed(false);
				return controller.openTargetFx({
					kind: "runtime",
					itemId: resolved.itemId,
					tab: resolved.tab,
					linesSearchQuery:
						resolved.tab === "lines"
							? linesSearchQuery?.trim() || undefined
							: undefined,
					origin: controller.readOrigin(origin),
				});
			}),
		[
			controller,
			resolveTarget,
		],
	);

	const openItemDefinitionDetailFx = useCallback(
		({ itemId, origin = null, tab }: OpenItemDefinitionDetailProps) =>
			Effect.suspend(() => {
				const resolved = resolveDefinitionTarget({
					itemId,
					requestedTab: tab,
				});
				if (resolved.kind === "unavailable") return Effect.succeed(false);
				return controller.openTargetFx({
					kind: "definition",
					itemId: resolved.itemId,
					tab: resolved.tab,
					origin: controller.readOrigin(origin),
				});
			}),
		[
			controller,
			resolveDefinitionTarget,
		],
	);

	const selectRetainedItemDetailTabFx = useCallback(
		({ itemId, tab }: SelectRetainedItemDetailTabProps) =>
			Effect.suspend(() => {
				const current = controller.getSnapshot().state;
				if (
					current.phase === "closed" ||
					current.phase === "exiting" ||
					current.target.kind !== "runtime" ||
					current.target.itemId !== itemId
				) {
					return Effect.succeed(false);
				}
				return controller.openTargetFx({
					...current.target,
					tab,
					linesSearchQuery: tab === "lines" ? current.target.linesSearchQuery : undefined,
				});
			}),
		[
			controller,
		],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const current = controller.getSnapshot().state;
			if (event.key !== "Escape" || current.phase === "closed") return;
			event.preventDefault();
			event.stopPropagation();
			if (current.phase !== "exiting") {
				close(undefined);
			}
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [
		controller,
		close,
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
			state: snapshot.state,
			isOpen: snapshot.state.phase !== "closed",
			readActionError: (key) => {
				const error = commandState.actionErrors.get(key);
				return error !== undefined && error.outcomeScope === controller.readOutcomeScope()
					? error.message
					: null;
			},
			readPendingAction: (key) => commandState.pendingActions.get(key)?.action ?? null,
			runPendingAction,
			openItemDetailFx,
			openItemDefinitionDetailFx,
			selectRetainedItemDetailTabFx,
			closeAtom: controller.closeAtom,
			closeFx: controller.closeFx,
			completeEnterFx: controller.completeEnterFx,
			completeExitFx: controller.completeExitFx,
		}),
		[
			controller,
			commandState,
			openItemDefinitionDetailFx,
			openItemDetailFx,
			runPendingAction,
			selectRetainedItemDetailTabFx,
			snapshot,
		],
	);

	return <ItemDetailContext.Provider value={control}>{children}</ItemDetailContext.Provider>;
};
