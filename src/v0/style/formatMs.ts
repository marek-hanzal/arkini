export const formatMs = (ms: number) => {
	if (ms <= 0) return "▶";

	const seconds = Math.ceil(ms / 1000);
	if (seconds < 60) return `${seconds}s`;

	return `${Math.ceil(seconds / 60)}m`;
};
