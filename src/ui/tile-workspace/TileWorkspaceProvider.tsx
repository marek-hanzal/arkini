import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TileItemId } from "~/bridge/tile/TileItemId";
import { TileWorkspaceContext } from "~/ui/tile-workspace/TileWorkspaceContext";
import type {
	TileWorkspacePhase,
	TileWorkspaceTarget,
} from "~/ui/tile-workspace/TileWorkspaceControl";

interface ExitCompletion {
	readonly promise: Promise<void>;
	readonly resolve: () => void;
}

/** Owns one exact tile target and one enter/open/exit workspace lifecycle. */
export const TileWorkspaceProvider = ({ children }: PropsWithChildren) => {
	const [phase, setPhase] = useState<TileWorkspacePhase>("closed");
	const [target, setTarget] = useState<TileWorkspaceTarget | null>(null);
	const phaseRef = useRef<TileWorkspacePhase>(phase);
	const targetRef = useRef<TileWorkspaceTarget | null>(target);
	const generationRef = useRef(0);
	const exitCompletionRef = useRef<ExitCompletion | undefined>(undefined);
	phaseRef.current = phase;
	targetRef.current = target;

	const openTarget = useCallback(
		(
			capability: TileWorkspaceTarget["capability"],
			itemId: TileItemId,
			origin: HTMLElement | null,
		) => {
			if (phaseRef.current !== "closed") return false;
			generationRef.current += 1;
			const nextTarget = {
				capability,
				itemId,
				origin,
				generation: generationRef.current,
			} as const satisfies TileWorkspaceTarget;
			targetRef.current = nextTarget;
			phaseRef.current = "entering";
			setTarget(nextTarget);
			setPhase("entering");
			return true;
		},
		[],
	);

	const openInfo = useCallback(
		(itemId: TileItemId, origin: HTMLElement | null) => openTarget("info", itemId, origin),
		[
			openTarget,
		],
	);

	const openStatus = useCallback(
		(itemId: TileItemId, origin: HTMLElement | null) => openTarget("status", itemId, origin),
		[
			openTarget,
		],
	);

	const openEffects = useCallback(
		(itemId: TileItemId, origin: HTMLElement | null) => openTarget("effects", itemId, origin),
		[
			openTarget,
		],
	);

	const close = useCallback(() => {
		if (phaseRef.current === "closed") return Promise.resolve();
		if (phaseRef.current === "exiting") {
			return exitCompletionRef.current?.promise ?? Promise.resolve();
		}
		let resolveExit: () => void = () => undefined;
		const promise = new Promise<void>((resolve) => {
			resolveExit = resolve;
		});
		exitCompletionRef.current = {
			promise,
			resolve: resolveExit,
		};
		phaseRef.current = "exiting";
		setPhase("exiting");
		return promise;
	}, []);

	const completeEnter = useCallback((generation: number) => {
		if (phaseRef.current !== "entering" || targetRef.current?.generation !== generation) return;
		phaseRef.current = "open";
		setPhase("open");
	}, []);

	const completeExit = useCallback((generation: number) => {
		if (phaseRef.current !== "exiting" || targetRef.current?.generation !== generation) return;
		phaseRef.current = "closed";
		targetRef.current = null;
		setPhase("closed");
		setTarget(null);
		exitCompletionRef.current?.resolve();
		exitCompletionRef.current = undefined;
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || phaseRef.current === "closed") return;
			event.preventDefault();
			event.stopPropagation();
			if (phaseRef.current === "entering" || phaseRef.current === "open") {
				void close();
			}
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [
		close,
	]);

	useEffect(
		() => () => {
			exitCompletionRef.current?.resolve();
			exitCompletionRef.current = undefined;
		},
		[],
	);

	const control = useMemo(
		() => ({
			phase,
			isOpen: phase !== "closed",
			target,
			openInfo,
			openStatus,
			openEffects,
			close,
			completeEnter,
			completeExit,
		}),
		[
			close,
			completeEnter,
			completeExit,
			openInfo,
			openStatus,
			openEffects,
			phase,
			target,
		],
	);

	return (
		<TileWorkspaceContext.Provider value={control}>{children}</TileWorkspaceContext.Provider>
	);
};
