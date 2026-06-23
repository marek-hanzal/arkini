import { type RefObject, useCallback, useEffect, useRef } from "react";

type TimerRef = RefObject<ReturnType<typeof setTimeout> | null>;

export namespace useTileActorTimers {
	export interface Result {
		singleTimerRef: TimerRef;
		longTimerRef: TimerRef;
		clearSingleTimer(): void;
		clearLongTimer(): void;
		clearTimers(): void;
	}
}

export const useTileActorTimers = (): useTileActorTimers.Result => {
	const singleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearSingleTimer = useCallback(() => {
		if (!singleTimerRef.current) return;
		clearTimeout(singleTimerRef.current);
		singleTimerRef.current = null;
	}, []);

	const clearLongTimer = useCallback(() => {
		if (!longTimerRef.current) return;
		clearTimeout(longTimerRef.current);
		longTimerRef.current = null;
	}, []);

	const clearTimers = useCallback(() => {
		clearSingleTimer();
		clearLongTimer();
	}, [
		clearLongTimer,
		clearSingleTimer,
	]);

	useEffect(
		() => () => {
			clearTimers();
		},
		[
			clearTimers,
		],
	);

	return {
		singleTimerRef,
		longTimerRef,
		clearSingleTimer,
		clearLongTimer,
		clearTimers,
	};
};
