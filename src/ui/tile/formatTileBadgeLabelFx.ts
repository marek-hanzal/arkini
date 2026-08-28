import { Effect } from "effect";

const formatTileBadgeCount = (count: number) => (count > 99 ? "99+" : String(count));

export namespace formatTileBadgeLabelFx {
	export interface Props {
		readonly count: number;
		readonly kind?: "queue";
	}
}

/** Formats one compact tile badge without exporting presentation-only helper grammar. */
export const formatTileBadgeLabelFx = Effect.fnUntraced(function* ({
	count,
	kind,
}: formatTileBadgeLabelFx.Props) {
	return `${kind === "queue" ? "x" : ""}${formatTileBadgeCount(count)}`;
});
