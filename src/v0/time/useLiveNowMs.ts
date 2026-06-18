import { useEffect, useMemo, useState } from "react";

const liveNowTickMs = 250;

export function useLiveNowMs(untilMs: readonly (number | null | undefined)[] = []) {
	const [nowMs, setNowMs] = useState(() => Date.now());
	const activeUntilMs = useMemo(
		() => untilMs.filter((time): time is number => typeof time === "number" && time > 0),
		[
			untilMs,
		],
	);
	const activeUntilKey = activeUntilMs.join("|");

	useEffect(() => {
		const readNow = () => Date.now();
		if (activeUntilMs.every((time) => time <= readNow())) return undefined;

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
