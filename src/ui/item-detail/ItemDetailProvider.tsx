import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useResolveItemDetailTarget } from "~/bridge/item-detail/useResolveItemDetailTarget";
import { ItemDetailContext } from "~/ui/item-detail/ItemDetailContext";
import type {
	ItemDetailControl,
	ItemDetailState,
	ItemDetailTarget,
	OpenItemDetailProps,
} from "~/ui/item-detail/ItemDetailControl";

interface ExitCompletion {
	readonly generation: number;
	readonly promise: Promise<void>;
	readonly resolve: () => void;
}

const closedState = {
	phase: "closed",
} as const satisfies ItemDetailState;

/** Owns one exact Item Detail target and one exhaustive enter/open/exit lifecycle. */
export const ItemDetailProvider = ({ children }: PropsWithChildren) => {
	const resolveTarget = useResolveItemDetailTarget();
	const [state, setState] = useState<ItemDetailState>(closedState);
	const stateRef = useRef<ItemDetailState>(state);
	const nextGeneration = useRef(0);
	const exitCompletionRef = useRef<ExitCompletion | undefined>(undefined);

	const publishState = useCallback((next: ItemDetailState) => {
		stateRef.current = next;
		setState(next);
	}, []);

	const resolveExitCompletion = useCallback((generation?: number) => {
		const completion = exitCompletionRef.current;
		if (
			completion === undefined ||
			(generation !== undefined && completion.generation !== generation)
		) {
			return;
		}
		exitCompletionRef.current = undefined;
		completion.resolve();
	}, []);

	const openItemDetail = useCallback(
		({ itemId, tab, origin = null }: OpenItemDetailProps) => {
			const resolved = resolveTarget({
				itemId,
				requestedTab: tab,
			});
			if (resolved.kind === "unavailable") return false;
			const current = stateRef.current;
			const target: ItemDetailTarget = {
				itemId: resolved.itemId,
				tab: resolved.tab,
				origin:
					current.phase !== "closed" && current.target.itemId === resolved.itemId
						? current.target.origin
						: origin,
			};

			if (
				(current.phase === "entering" || current.phase === "open") &&
				current.target.itemId === target.itemId
			) {
				if (current.target.tab === target.tab) return true;
				publishState({
					...current,
					target,
				});
				return true;
			}

			if (current.phase === "exiting") resolveExitCompletion(current.generation);
			publishState({
				phase: "entering",
				target,
				generation: ++nextGeneration.current,
			});
			return true;
		},
		[
			publishState,
			resolveExitCompletion,
			resolveTarget,
		],
	);

	const close = useCallback(() => {
		const current = stateRef.current;
		if (current.phase === "closed") return Promise.resolve();
		if (current.phase === "exiting") {
			return exitCompletionRef.current?.promise ?? Promise.resolve();
		}
		let resolve: () => void = () => undefined;
		const promise = new Promise<void>((complete) => {
			resolve = complete;
		});
		exitCompletionRef.current = {
			generation: current.generation,
			promise,
			resolve,
		};
		publishState({
			phase: "exiting",
			target: current.target,
			generation: current.generation,
		});
		return promise;
	}, [
		publishState,
	]);

	const completeEnter = useCallback(
		(generation: number) => {
			const current = stateRef.current;
			if (current.phase !== "entering" || current.generation !== generation) return;
			publishState({
				phase: "open",
				target: current.target,
				generation,
			});
		},
		[
			publishState,
		],
	);

	const completeExit = useCallback(
		(generation: number) => {
			const current = stateRef.current;
			if (current.phase !== "exiting" || current.generation !== generation) return;
			publishState(closedState);
			resolveExitCompletion(generation);
		},
		[
			publishState,
			resolveExitCompletion,
		],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const current = stateRef.current;
			if (event.key !== "Escape" || current.phase === "closed") return;
			event.preventDefault();
			event.stopPropagation();
			if (current.phase !== "exiting") void close();
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [
		close,
	]);

	useEffect(
		() => () => {
			resolveExitCompletion();
			stateRef.current = closedState;
		},
		[
			resolveExitCompletion,
		],
	);

	const control = useMemo<ItemDetailControl>(
		() => ({
			state,
			isOpen: state.phase !== "closed",
			openItemDetail,
			close,
			completeEnter,
			completeExit,
		}),
		[
			close,
			completeEnter,
			completeExit,
			openItemDetail,
			state,
		],
	);

	return <ItemDetailContext.Provider value={control}>{children}</ItemDetailContext.Provider>;
};
