import { useLayoutEffect, useRef } from "react";

/**
 * Retains the last authoritative projection only to make actor disappearance
 * visually intelligible during Detail teardown. Consumers must mark the result
 * stale and inert; retained values are never permission to issue gameplay
 * commands or pretend the runtime item still exists.
 */
export const useRetainedItemDetailProjection = <Value>({
	available,
	targetKey,
	value,
}: {
	readonly available: boolean;
	readonly targetKey: string;
	readonly value: Value;
}) => {
	const retained = useRef<
		| {
				readonly targetKey: string;
				readonly value: Value;
		  }
		| undefined
	>(undefined);
	useLayoutEffect(() => {
		if (!available) return;
		retained.current = {
			targetKey,
			value,
		};
	}, [
		available,
		targetKey,
		value,
	]);
	const committed =
		retained.current?.targetKey === targetKey ? retained.current.value : undefined;
	return {
		value: available ? value : committed,
		stale: !available,
	};
};
