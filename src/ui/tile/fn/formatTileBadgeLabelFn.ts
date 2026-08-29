const formatTileBadgeCount = (count: number) => (count > 99 ? "99+" : String(count));

export namespace formatTileBadgeLabelFn {
	export interface Props {
		readonly count: number;
		readonly kind?: "queue";
	}
}

/** Formats one compact tile badge without exporting presentation-only helper grammar. */
export const formatTileBadgeLabelFn = ({ count, kind }: formatTileBadgeLabelFn.Props) =>
	`${kind === "queue" ? "x" : ""}${formatTileBadgeCount(count)}`;
