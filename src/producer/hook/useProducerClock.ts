import { useEffect, useMemo, useState } from "react";
import type { BoardViewItem } from "~/play/logic/playTypes";

const producerClockTickMs = 250;

export function useProducerClock(items: readonly BoardViewItem[]) {
	const cooldownKey = useMemo(
		() =>
			items
				.map((item) => item.producer?.cooldownUntil ?? "")
				.filter(Boolean)
				.sort()
				.join("|"),
		[
			items,
		],
	);
	const [nowMs, setNowMs] = useState(Date.now);

	useEffect(() => {
		const cooldowns = cooldownKey
			.split("|")
			.filter(Boolean)
			.map((value) => Date.parse(value))
			.filter((value) => Number.isFinite(value));

		if (!cooldowns.length) {
			setNowMs(Date.now());
			return;
		}

		const tick = () => {
			const nextNowMs = Date.now();
			setNowMs(nextNowMs);
			return nextNowMs;
		};
		const hasFutureCooldown = () => cooldowns.some((untilMs) => untilMs > Date.now());

		if (!hasFutureCooldown()) {
			tick();
			return;
		}

		tick();
		const interval = window.setInterval(() => {
			const nextNowMs = tick();
			if (cooldowns.every((untilMs) => untilMs <= nextNowMs)) {
				window.clearInterval(interval);
			}
		}, producerClockTickMs);

		return () => window.clearInterval(interval);
	}, [
		cooldownKey,
	]);

	return nowMs;
}
