import { useEffect, useMemo, useState } from "react";
import type { BoardViewItem } from "~/play/logic/playTypes";

const producerClockTickMs = 250;

export function useProducerClock(items: readonly BoardViewItem[]) {
	const [nowMs, setNowMs] = useState(() => Date.now());

	const activeUntilMs = useMemo(
		() => items.map((item) => item.activation?.cooldownUntilMs ?? 0).filter(Boolean),
		[
			items,
		],
	);

	useEffect(() => {
		if (activeUntilMs.length === 0) return undefined;

		const interval = window.setInterval(() => {
			setNowMs(Date.now());
		}, producerClockTickMs);

		return () => window.clearInterval(interval);
	}, [
		activeUntilMs,
	]);

	return nowMs;
}
