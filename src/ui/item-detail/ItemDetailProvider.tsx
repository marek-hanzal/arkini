import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { match } from "ts-pattern";

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
			const existingOrigin = match(current)
				.with(
					{
						phase: "closed",
					},
					() => origin,
				)
				.with(
					{
						phase: "entering",
					},
					{
						phase: "open",
					},
					{
						phase: "exiting",
					},
					(state) => state.target.origin,
				)
				.exhaustive();
			const target: ItemDetailTarget = {
				itemId: resolved.itemId,
				tab: resolved.tab,
				origin: existingOrigin,
			};
			const enter = () => {
				publishState({
					phase: "entering",
					target,
					generation: ++nextGeneration.current,
				});
				return true;
			};

			return match(current)
				.with(
					{
						phase: "closed",
					},
					() => enter(),
				)
				.with(
					{
						phase: "entering",
					},
					{
						phase: "open",
					},
					(current) => {
						if (
							current.target.itemId !== target.itemId ||
							current.target.tab !== target.tab
						) {
							publishState({
								...current,
								target,
							});
						}
						return true;
					},
				)
				.with(
					{
						phase: "exiting",
					},
					(current) => {
						resolveExitCompletion(current.generation);
						return enter();
					},
				)
				.exhaustive();
		},
		[
			publishState,
			resolveExitCompletion,
			resolveTarget,
		],
	);

	const close = useCallback(
		({ restoreFocus = true } = {}) => {
			const current = stateRef.current;
			const beginExit = (
				state: Extract<
					ItemDetailState,
					{
						phase: "entering" | "open";
					}
				>,
			) => {
				let resolve: () => void = () => undefined;
				const promise = new Promise<void>((complete) => {
					resolve = complete;
				});
				exitCompletionRef.current = {
					generation: state.generation,
					promise,
					resolve,
				};
				publishState({
					phase: "exiting",
					target: state.target,
					generation: state.generation,
					restoreFocus,
				});
				return promise;
			};

			return match(current)
				.with(
					{
						phase: "closed",
					},
					() => Promise.resolve(),
				)
				.with(
					{
						phase: "entering",
					},
					{
						phase: "open",
					},
					(state) => beginExit(state),
				)
				.with(
					{
						phase: "exiting",
					},
					(state) => {
						if (!restoreFocus && state.restoreFocus) {
							publishState({
								...state,
								restoreFocus: false,
							});
						}
						return exitCompletionRef.current?.promise ?? Promise.resolve();
					},
				)
				.exhaustive();
		},
		[
			publishState,
		],
	);

	const completeEnter = useCallback(
		(generation: number) => {
			match(stateRef.current)
				.with(
					{
						phase: "entering",
					},
					(state) => {
						if (state.generation !== generation) return;
						publishState({
							phase: "open",
							target: state.target,
							generation,
						});
					},
				)
				.with(
					{
						phase: "closed",
					},
					{
						phase: "open",
					},
					{
						phase: "exiting",
					},
					() => undefined,
				)
				.exhaustive();
		},
		[
			publishState,
		],
	);

	const completeExit = useCallback(
		(generation: number) => {
			match(stateRef.current)
				.with(
					{
						phase: "exiting",
					},
					(state) => {
						if (state.generation !== generation) return;
						publishState(closedState);
						resolveExitCompletion(generation);
					},
				)
				.with(
					{
						phase: "closed",
					},
					{
						phase: "entering",
					},
					{
						phase: "open",
					},
					() => undefined,
				)
				.exhaustive();
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
