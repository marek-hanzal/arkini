import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Owns one mounted presentation action claim with same-tick admission. */
export const useExclusiveAction = <Action extends string>() => {
	const activeRef = useRef<Action | null>(null);
	const mountedRef = useRef(false);
	const [active, setActive] = useState<Action | null>(null);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);
	const claim = useCallback((action: Action) => {
		if (activeRef.current !== null) return false;
		activeRef.current = action;
		if (mountedRef.current) setActive(action);
		return true;
	}, []);
	const release = useCallback((action: Action) => {
		if (activeRef.current !== action) return;
		activeRef.current = null;
		if (mountedRef.current) setActive(null);
	}, []);

	return useMemo(
		() => ({
			active,
			claim,
			release,
		}),
		[
			active,
			claim,
			release,
		],
	);
};
