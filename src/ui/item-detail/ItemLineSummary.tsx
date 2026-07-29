import { AnimatePresence, motion } from "motion/react";

import { JobStatusEnumSchema } from "~/bridge/job/JobStatusEnumSchema";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { itemDetailBadgeMotion, itemDetailFadeMotion } from "~/ui/item-detail/ItemDetailMotion";

/** Renders one line's identity, default marker, and description. */
export const ItemLineSummary = ({
	line,
	stale = false,
}: {
	readonly line: ItemDetailLines.Line;
	readonly stale?: boolean;
}) => {
	const status =
		line.activeJob?.status === JobStatusEnumSchema.enum.Paused
			? {
					className: "border-success/40 bg-success/12",
					label: "Paused",
				}
			: line.activeJob === undefined && line.availability.kind === "unavailable"
				? {
						className: "border-danger/35 bg-danger/10",
						label: "Disabled",
					}
				: undefined;

	return (
		<div className="min-w-0 flex-1">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="text-lg font-semibold leading-tight text-foreground">
					{line.title}
				</h3>
				<AnimatePresence initial={false}>
					{stale || status === undefined ? null : (
						<motion.span
							key={status.label}
							layout
							className={`rounded-full border px-2.5 py-1 text-xs font-semibold text-foreground ${status.className}`}
							data-ui="TileLineStatusBadge"
							{...itemDetailBadgeMotion}
						>
							{status.label}
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
							Default
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
