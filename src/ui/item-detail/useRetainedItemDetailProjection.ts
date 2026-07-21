import { useRef } from "react";

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
	if (retained.current?.targetKey !== targetKey) retained.current = undefined;
	if (available) {
		retained.current = {
			targetKey,
			value,
		};
	}
	return {
		value: available ? value : retained.current?.value,
		stale: !available,
	};
};
