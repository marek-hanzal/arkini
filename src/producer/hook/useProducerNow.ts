import { useEffect, useState } from "react";
import type { ProducerView } from "~/play/logic/playTypes";

const producerClockTickMs = 250;

export function useProducerNow(producer: ProducerView | null | undefined) {
	const [nowMs, setNowMs] = useState(Date.now);
	const cooldownUntil = producer?.cooldownUntil ?? null;

	useEffect(() => {
		if (!cooldownUntil) return;

		const cooldownUntilMs = Date.parse(cooldownUntil);
		const tick = () => {
			const nextNowMs = Date.now();
			setNowMs(nextNowMs);
			return nextNowMs;
		};

		if (cooldownUntilMs <= tick()) return;

		const interval = window.setInterval(() => {
			if (cooldownUntilMs <= tick()) window.clearInterval(interval);
		}, producerClockTickMs);

		return () => window.clearInterval(interval);
	}, [
		cooldownUntil,
	]);

	return nowMs;
}
