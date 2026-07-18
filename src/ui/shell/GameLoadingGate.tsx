import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { GameLoadingScreen } from "~/ui/shell/GameLoadingScreen";

export namespace GameLoadingGate {
	export interface Props {
		readonly children: ReactNode;
		readonly failure: ReactNode | null;
		readonly ready: boolean;
	}
}

const activeNativeViewTransitionAnimations = () => {
	if (typeof document.getAnimations !== "function") return [];
	return document.getAnimations().filter((animation) => {
		const effect = animation.effect as
			| (AnimationEffect & {
					readonly pseudoElement?: string;
			  })
			| null;
		return effect?.pseudoElement?.startsWith("::view-transition-") === true;
	});
};

/** Holds the first board reveal until loading progress reaches and briefly displays 100%. */
export const GameLoadingGate = ({ children, failure, ready }: GameLoadingGate.Props) => {
	const [initialLoadComplete, setInitialLoadComplete] = useState(false);
	const completionRequestedRef = useRef(false);
	const failedRef = useRef(failure !== null);
	const mountedRef = useRef(true);
	const readyRef = useRef(ready);
	const revealAttemptRef = useRef(0);
	failedRef.current = failure !== null;
	readyRef.current = ready;

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			revealAttemptRef.current += 1;
		};
	}, []);

	useEffect(() => {
		if (ready && failure === null) return;
		completionRequestedRef.current = false;
		revealAttemptRef.current += 1;
	}, [
		failure,
		ready,
	]);

	const completeInitialLoad = useCallback(() => {
		if (completionRequestedRef.current) return;
		completionRequestedRef.current = true;
		const revealAttempt = revealAttemptRef.current + 1;
		revealAttemptRef.current = revealAttempt;
		const canReveal = () =>
			mountedRef.current &&
			readyRef.current &&
			!failedRef.current &&
			revealAttemptRef.current === revealAttempt;

		const commitReveal = () => {
			if (!canReveal()) return;
			if (typeof document.startViewTransition !== "function") {
				setInitialLoadComplete(true);
				return;
			}
			try {
				document.startViewTransition(() => {
					if (!canReveal()) return;
					flushSync(() => setInitialLoadComplete(true));
				});
			} catch {
				if (canReveal()) setInitialLoadComplete(true);
			}
		};

		const activeAnimations = activeNativeViewTransitionAnimations();
		if (activeAnimations.length === 0) {
			commitReveal();
			return;
		}
		void Promise.allSettled(activeAnimations.map((animation) => animation.finished)).then(
			commitReveal,
		);
	}, []);

	if (failure !== null) return failure;
	if (initialLoadComplete) return children;

	return (
		<GameLoadingScreen
			ready={!initialLoadComplete && ready}
			onComplete={initialLoadComplete ? undefined : completeInitialLoad}
		/>
	);
};
