import { AnimatePresence, motion } from "motion/react";
import type { ComponentType, ReactNode } from "react";

import { JobStatusEnumSchema } from "~/production-job/schema/read/JobStatusEnumSchema";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import {
	itemDetailBadgeMotion,
	itemDetailFadeMotion,
} from "~/item-detail-frame/ui/ItemDetailMotion";

interface ItemLineSummaryIdentityRenderProps {
	readonly children: ReactNode;
	readonly disabled: boolean;
	readonly itemId: string;
	readonly lineId: string;
}

export type ItemLineSummaryIdentityRenderer = ComponentType<ItemLineSummaryIdentityRenderProps>;

/** Renders one line's identity, default marker, and description. */
export const ItemLineSummary = ({
	disabled = false,
	itemId,
	line,
	renderIdentity,
	stale = false,
}: {
	readonly disabled?: boolean;
	readonly itemId?: string;
	readonly line: ItemDetailLinesProjection.Line;
	readonly renderIdentity?: ItemLineSummaryIdentityRenderer;
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

	const IdentityRenderer = renderIdentity;
	return (
		<div className="min-w-0 flex-1">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="text-lg font-semibold leading-tight text-foreground">
					{IdentityRenderer === undefined || itemId === undefined ? (
						line.title
					) : (
						<IdentityRenderer
							disabled={disabled}
							itemId={itemId}
							lineId={line.lineId}
						>
							{line.title}
						</IdentityRenderer>
					)}
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
