/** Countdown retains tenths and numeric zero; authored durations keep compact whole units. */
export const formatDurationFn = (
	milliseconds: number,
	mode: "duration" | "countdown" = "duration",
) => {
	if (milliseconds === 0 && mode === "duration") return "Immediate";
	const precision = mode === "countdown" || milliseconds < 60_000 ? 10 : 1;
	// Round before splitting units so a carry never renders as "60.0 s".
	const ticks = Math.round((Math.max(0, milliseconds) * precision) / 1_000);
	const hours = Math.floor(ticks / (3_600 * precision));
	const minutes = Math.floor((ticks % (3_600 * precision)) / (60 * precision));
	const remainingSeconds = (ticks % (60 * precision)) / precision;
	const parts: string[] = [];
	if (hours !== 0) parts.push(`${hours} h`);
	if (minutes !== 0) parts.push(`${minutes} min`);
	if (mode === "countdown") parts.push(`${remainingSeconds.toFixed(1)} s`);
	else if (remainingSeconds !== 0 || parts.length === 0) parts.push(`${remainingSeconds} s`);
	return parts.join(" ");
};
