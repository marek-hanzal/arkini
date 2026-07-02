import { useEffect, useLayoutEffect, useMemo, useState } from "react";

const liveNowTickMs = 250;
const useLiveNowEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useLiveNowMs(untilMs: readonly (number | null | undefined)[] = []) {
	const [nowMs, setNowMs] = useState(() => Date.now());
	const activeUntilMs = useMemo(
		() => untilMs.filter((time): time is number => typeof time === "number" && time > 0),
		[
			untilMs,
		],
	);
	const activeUntilKey = activeUntilMs.join("|");

	useLiveNowEffect(() => {
		const readNow = () => Date.now();
		const initialNowMs = readNow();
		setNowMs(initialNowMs);
		if (activeUntilMs.every((time) => time <= initialNowMs)) return undefined;

		const interval = window.setInterval(() => {
			const nextNowMs = readNow();
			setNowMs(nextNowMs);

			if (activeUntilMs.every((time) => time <= nextNowMs)) {
				window.clearInterval(interval);
			}
		}, liveNowTickMs);

		return () => window.clearInterval(interval);
	}, [
		activeUntilKey,
	]);

	return nowMs;
}
