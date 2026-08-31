import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Owns one mounted presentation action claim with same-tick admission. */
export const useExclusiveAction = <Action extends string>() => {
	const activeRef = useRef<Action | null>(null);
	const mountedRef = useRef(false);
	const [active, setActiveFn] = useState<Action | null>(null);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);
	const claimFn = useCallback((action: Action) => {
		if (activeRef.current !== null) return false;
		activeRef.current = action;
		if (mountedRef.current) setActiveFn(action);
		return true;
	}, []);
	const releaseFn = useCallback((action: Action) => {
		if (activeRef.current !== action) return;
		activeRef.current = null;
		if (mountedRef.current) setActiveFn(null);
	}, []);

	return useMemo(
		() => ({
			active,
			claimFn,
			releaseFn,
		}),
		[
			active,
			claimFn,
			releaseFn,
		],
	);
};
