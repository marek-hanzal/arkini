import { Effect } from "effect";
import {
	type PropsWithChildren,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";

import { useResolveItemDefinitionDetailTarget } from "~/bridge/item-detail/useResolveItemDefinitionDetailTarget";
import { useResolveItemDetailTarget } from "~/bridge/item-detail/useResolveItemDetailTarget";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { createItemDetailControllerFx } from "~/ui/item-detail/createItemDetailControllerFx";
import { ItemDetailContext } from "~/ui/item-detail/ItemDetailContext";
import type {
	ItemDetailControl,
	OpenItemDefinitionDetailProps,
	OpenItemDetailProps,
} from "~/ui/item-detail/ItemDetailControl";

/** Owns one exact Item Detail target and one exhaustive enter/open/exit lifecycle. */
export const ItemDetailProvider = ({ children }: PropsWithChildren) => {
	const resolveDefinitionTarget = useResolveItemDefinitionDetailTarget();
	const resolveTarget = useResolveItemDetailTarget();
	const [controller] = useState(() => RendererRuntime.runSync(createItemDetailControllerFx()));
	const snapshot = useSyncExternalStore(
		controller.subscribe,
		controller.getSnapshot,
		controller.getSnapshot,
	);

	const openItemDetailFx = useCallback(
		({ itemId, tab, origin = null }: OpenItemDetailProps) =>
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

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const current = controller.getSnapshot().state;
			if (event.key !== "Escape" || current.phase === "closed") return;
			event.preventDefault();
			event.stopPropagation();
			if (current.phase !== "exiting") {
				void RendererRuntime.runPromise(controller.closeFx());
			}
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [
		controller,
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
			hasPendingActions: snapshot.pendingActions.size > 0,
			readActionError: controller.readActionError,
			readPendingAction: controller.readPendingAction,
			runPendingActionFx: controller.runPendingActionFx,
			openItemDetailFx,
			openItemDefinitionDetailFx,
			closeFx: controller.closeFx,
			completeEnterFx: controller.completeEnterFx,
			completeExitFx: controller.completeExitFx,
		}),
		[
			controller,
			openItemDefinitionDetailFx,
			openItemDetailFx,
			snapshot,
		],
	);

	return <ItemDetailContext.Provider value={control}>{children}</ItemDetailContext.Provider>;
};
