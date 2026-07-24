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
import { createItemDetailController } from "~/ui/item-detail/createItemDetailController";
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
	const [controller] = useState(createItemDetailController);
	const snapshot = useSyncExternalStore(
		controller.subscribe,
		controller.getSnapshot,
		controller.getSnapshot,
	);

	const openItemDetail = useCallback(
		({ itemId, tab, origin = null }: OpenItemDetailProps) => {
			const resolved = resolveTarget({
				itemId,
				requestedTab: tab,
			});
			if (resolved.kind === "unavailable") return false;
			return controller.openTarget({
				kind: "runtime",
				itemId: resolved.itemId,
				tab: resolved.tab,
				origin: controller.readOrigin(origin),
			});
		},
		[
			controller,
			resolveTarget,
		],
	);

	const openItemDefinitionDetail = useCallback(
		({ itemId, origin = null, tab }: OpenItemDefinitionDetailProps) => {
			const resolved = resolveDefinitionTarget({
				itemId,
				requestedTab: tab,
			});
			if (resolved.kind === "unavailable") return false;
			return controller.openTarget({
				kind: "definition",
				itemId: resolved.itemId,
				tab: resolved.tab,
				origin: controller.readOrigin(origin),
			});
		},
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
			if (current.phase !== "exiting") void controller.close();
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [
		controller,
	]);

	useEffect(
		() => () => {
			controller.reset();
		},
		[
			controller,
		],
	);

	const control = useMemo<ItemDetailControl>(
		() => ({
			state: snapshot.state,
			isOpen: snapshot.state.phase !== "closed",
			readActionError: controller.readActionError,
			readPendingAction: controller.readPendingAction,
			runPendingAction: controller.runPendingAction,
			openItemDetail,
			openItemDefinitionDetail,
			close: controller.close,
			completeEnter: controller.completeEnter,
			completeExit: controller.completeExit,
		}),
		[
			controller,
			openItemDefinitionDetail,
			openItemDetail,
			snapshot,
		],
	);

	return <ItemDetailContext.Provider value={control}>{children}</ItemDetailContext.Provider>;
};
