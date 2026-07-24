import { match } from "ts-pattern";

import { JobStatusEnumSchema } from "~/bridge/job/JobStatusEnumSchema";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";

/** Renders one line's identity, readiness, active state, and description. */
export const ItemLineSummary = ({ line }: { readonly line: ItemDetailLines.Line }) => {
	const readiness = match(line.availability)
		.with(
			{
				kind: "ready",
			},
			() => ({
				label: "Ready",
				className: "border-success/35 bg-success/12 text-foreground",
			}),
		)
		.with(
			{
				kind: "blocked",
				reason: "disabled",
			},
			() => ({
				label: "Disabled",
				className: "border-danger/35 bg-danger/10 text-foreground",
			}),
		)
		.with(
			{
				kind: "blocked",
				reason: "inputs",
			},
			() => ({
				label: "Missing inputs",
				className: "border-warning/35 bg-warning/10 text-foreground",
			}),
		)
		.with(
			{
				kind: "blocked",
				reason: "queue",
			},
			() => ({
				label: "Queue full",
				className: "border-warning/35 bg-warning/10 text-foreground",
			}),
		)
		.with(
			{
				kind: "blocked",
				reason: "stored",
			},
			() => ({
				label: "Stored",
				className: "border-line bg-surface text-muted",
			}),
		)
		.exhaustive();
	const activeWork =
		line.activeJob === undefined
			? undefined
			: match(line.activeJob.status)
					.with(JobStatusEnumSchema.enum.Running, () => "Running")
					.with(JobStatusEnumSchema.enum.Paused, () => "Paused")
					.with(JobStatusEnumSchema.enum.AwaitingOutput, () => "Awaiting output")
					.exhaustive();

	return (
		<div className="min-w-0 flex-1">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="text-lg font-semibold leading-tight text-foreground">
					{line.title}
				</h3>
				{activeWork === undefined ? null : (
					<span className="rounded-full border border-success/40 bg-success/12 px-2.5 py-1 text-xs font-semibold text-foreground">
						{activeWork}
					</span>
				)}
				<span
					className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${readiness.className}`}
				>
					{readiness.label}
				</span>
				{line.isDefault ? (
					<span
						className="rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-foreground"
						data-ui="TileLineDefaultBadge"
					>
						Default
					</span>
				) : null}
			</div>
			<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{line.description}</p>
		</div>
	);
};
