/** Formats an authored millisecond duration for compact item presentation. */
export const formatItemDurationFn = (milliseconds: number) => {
	if (milliseconds === 0) return "Immediate";
	const seconds = milliseconds / 1_000;
	if (seconds < 60) return Number.isInteger(seconds) ? `${seconds} s` : `${seconds.toFixed(1)} s`;
	const roundedSeconds = Math.round(seconds);
	const hours = Math.floor(roundedSeconds / 3_600);
	const minutes = Math.floor((roundedSeconds % 3_600) / 60);
	const remainingSeconds = roundedSeconds % 60;
	const parts: string[] = [];
	if (hours !== 0) parts.push(`${hours} h`);
	if (minutes !== 0) parts.push(`${minutes} min`);
	if (remainingSeconds !== 0) parts.push(`${remainingSeconds} s`);
	return parts.join(" ");
};
