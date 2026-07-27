/** Keeps compact tile badges readable without hiding that a count exceeds two digits. */
export const formatTileBadgeCount = (count: number) => (count > 99 ? "99+" : String(count));
