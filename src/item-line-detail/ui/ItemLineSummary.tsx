import { AnimatePresence, motion } from "motion/react";

import { JobStatusEnumSchema } from "~/production-job/schema/JobStatusEnumSchema";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import {
	itemDetailBadgeMotion,
	itemDetailFadeMotion,
} from "~/item-detail-frame/ui/ItemDetailMotion";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { Tx } from "~/translation/ui/Tx";

/** Renders one line's identity, default marker, and description. */
export const ItemLineSummary = ({
	line,
	stale = false,
}: {
	readonly line: ItemDetailLinesProjection.Line;
	readonly stale?: boolean;
}) => {
	const durationMs = line.activeJob?.remainingMs ?? line.effectiveRuntimeMs;
	const status =
		line.activeJob?.status === JobStatusEnumSchema.enum.Paused
			? "paused"
			: line.activeJob === undefined && line.availability.kind === "unavailable"
				? "disabled"
				: undefined;
	return (
		<div className="min-w-0 flex-1">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="text-lg font-semibold leading-tight text-foreground">
					{line.title}
					{stale ? null : (
						<span
							className="whitespace-nowrap font-normal tabular-nums text-muted"
							data-ui="TileLineRuntime"
						>
							{" · "}
							{formatDurationFn(
								line.activeJob?.remainingMs ?? line.effectiveRuntimeMs,
							)}
						</span>
					)}
				</h3>
				<AnimatePresence initial={false}>
					{stale || status === undefined ? null : (
						<motion.span
							key={status}
							layout
							className="rounded-full border px-2.5 py-1 text-xs font-semibold text-foreground data-[ui-status=disabled]:border-danger/35 data-[ui-status=disabled]:bg-danger/10 data-[ui-status=paused]:border-success/40 data-[ui-status=paused]:bg-success/12"
							{...itemDetailBadgeMotion}
							{...readDataUiFn({
								dataUi: "TileLineStatusBadge",
								state: {
									status,
								},
							})}
						>
							<Tx label={status === "paused" ? "Paused" : "Disabled"} />
						</motion.span>
					)}
				</AnimatePresence>
				<AnimatePresence initial={false}>
					{stale || !line.isDefault ? null : (
						<motion.span
							key="default"
							layout
							className="rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-foreground"
							data-ui="TileLineDefaultBadge"
							{...itemDetailBadgeMotion}
						>
							<Tx label="Default" />
						</motion.span>
					)}
				</AnimatePresence>
			</div>
			<motion.p
				key={line.description}
				className="mt-2 max-w-3xl text-sm leading-relaxed text-muted"
				{...itemDetailFadeMotion}
			>
				{line.description}
			</motion.p>
		</div>
	);
};
