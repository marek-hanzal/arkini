import { useEffect, useMemo, useState } from "react";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";

const producerClockTickMs = 250;

export function useProducerClock(items: readonly BoardViewItem[]) {
	const [nowMs, setNowMs] = useState(() => Date.now());

	const activeUntilMs = useMemo(
		() =>
			items
				.flatMap((item) => [
					item.activation?.cooldownUntilMs ?? 0,
					item.craft?.readyAtMs ?? 0,
				])
				.filter(Boolean),
		[
			items,
		],
	);

	useEffect(() => {
		if (activeUntilMs.every((time) => time <= Date.now())) return undefined;

		const interval = window.setInterval(() => {
			const nextNowMs = Date.now();
			setNowMs(nextNowMs);

			if (activeUntilMs.every((time) => time <= nextNowMs)) {
				window.clearInterval(interval);
			}
		}, producerClockTickMs);

		return () => window.clearInterval(interval);
	}, [
		activeUntilMs,
	]);

	return nowMs;
}
