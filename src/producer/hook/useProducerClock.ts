import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import type { BoardViewItem } from "~/play/logic/playTypes";

const producerClockTickMs = 250;

export function useProducerClock(items: readonly BoardViewItem[]) {
	const cooldownKey = useMemo(
		() =>
			items
				.map((item) => item.producer?.cooldownUntilMs ?? 0)
				.filter(Boolean)
				.sort((left, right) => left - right)
				.join("|"),
		[
			items,
		],
	);
	const [nowMs, setNowMs] = useState(() => DateTime.now().toMillis());

	useEffect(() => {
		const cooldowns = cooldownKey
			.split("|")
			.filter(Boolean)
			.map(Number)
			.filter((value) => Number.isFinite(value));

		if (!cooldowns.length) {
			setNowMs(DateTime.now().toMillis());
			return;
		}

		const tick = () => {
			const nextNowMs = DateTime.now().toMillis();
			setNowMs(nextNowMs);
			return nextNowMs;
		};
		const hasFutureCooldown = () =>
			cooldowns.some((untilMs) => untilMs > DateTime.now().toMillis());

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
