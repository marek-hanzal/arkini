import { useLayoutEffect, useRef } from "react";

/** Retains the last authoritative projection for one exact target after that target disappears. */
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
