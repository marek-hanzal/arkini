import { AnimatePresence, motion } from "motion/react";
import { match } from "ts-pattern";

import { JobStatusEnumSchema } from "~/bridge/job/JobStatusEnumSchema";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { BadgeCount } from "~/ui/badge/BadgeCount";
import { itemDetailBadgeMotion, itemDetailFadeMotion } from "~/ui/item-detail/ItemDetailMotion";

/** Renders one line's identity, readiness, active state, and description. */
export const ItemLineSummary = ({
	line,
	stale = false,
}: {
	readonly line: ItemDetailLines.Line;
	readonly stale?: boolean;
}) => {
	const readiness = match(line.availability)
		.with(
			{
				kind: "available",
				readiness: "ready",
			},
			() => ({
				label: "Ready",
				className: "border-success/35 bg-success/12 text-foreground",
			}),
		)
		.with(
			{
				kind: "unavailable",
			},
			() => ({
				label: "Disabled",
				className: "border-danger/35 bg-danger/10 text-foreground",
			}),
		)
		.with(
			{
				kind: "available",
				readiness: "inputs",
			},
			() => ({
				label: "Missing inputs",
				className: "border-warning/35 bg-warning/10 text-foreground",
			}),
		)
		.with(
			{
				kind: "available",
				readiness: "queue",
			},
			() => ({
				label: "Queue full",
				className: "border-warning/35 bg-warning/10 text-foreground",
			}),
		)
		.exhaustive();
	const activeWork =
		line.activeJob === undefined
			? undefined
			: match(line.activeJob.status)
					.with(JobStatusEnumSchema.enum.Running, () => undefined)
					.with(JobStatusEnumSchema.enum.Paused, () => "Paused")
					.with(JobStatusEnumSchema.enum.AwaitingOutput, () => "Awaiting output")
					.exhaustive();

	return (
		<div className="min-w-0 flex-1">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="text-lg font-semibold leading-tight text-foreground">
					{line.title}
				</h3>
				<AnimatePresence
					initial={false}
					mode="popLayout"
				>
					{stale || activeWork === undefined ? null : (
						<motion.span
							key={`active:${activeWork}`}
							layout
							className="rounded-full border border-success/40 bg-success/12 px-2.5 py-1 text-xs font-semibold text-foreground"
							{...itemDetailBadgeMotion}
						>
							{activeWork}
						</motion.span>
					)}
				</AnimatePresence>
				<AnimatePresence
					initial={false}
					mode="popLayout"
				>
					{stale ||
					line.activeJob !== undefined ||
					line.queuedRequestCount === 0 ? null : (
						<motion.span
							key={`queued:${line.queuedRequestCount}`}
							layout
							{...itemDetailBadgeMotion}
						>
							<BadgeCount
								count={line.queuedRequestCount}
								dataUi="TileLineQueuedBadge"
								label="Queued"
							/>
						</motion.span>
					)}
				</AnimatePresence>
				<AnimatePresence
					initial={false}
					mode="popLayout"
				>
					{stale || line.activeJob !== undefined ? null : (
						<motion.span
							key={`readiness:${readiness.label}`}
							layout
							className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${readiness.className}`}
							data-ui="TileLineReadinessBadge"
							{...itemDetailBadgeMotion}
						>
							{readiness.label}
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
