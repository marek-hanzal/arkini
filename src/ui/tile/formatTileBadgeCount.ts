/** Keeps compact tile badges readable without hiding that a count exceeds two digits. */
export const formatTileBadgeCount = (count: number) => (count > 99 ? "99+" : String(count));

/** Distinguishes queued work from stack quantities and remaining charges. */
export const formatTileBadgeLabel = ({
	count,
	kind,
}: {
	readonly count: number;
	readonly kind?: "queue";
}) => `${kind === "queue" ? "x" : ""}${formatTileBadgeCount(count)}`;
