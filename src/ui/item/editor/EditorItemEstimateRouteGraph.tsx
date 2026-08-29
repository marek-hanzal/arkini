import type { EditorProject } from "~/editor/EditorProject";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import type { EditorItemEstimateRouteStep } from "~/editor/estimator/EditorItemEstimate";
import { type ReactNode, useState } from "react";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";
import { EditorItemDetailReference } from "~/ui/item/editor/EditorItemDetailReference";

const formatQuantity = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const formatRuntime = (runtimeMs: number) =>
	RendererRuntime.runSync(formatItemDurationFx(runtimeMs));

type EditorItemEstimateSort = "quantity" | "time";

/** Presents compressed selected-route occurrence groups as compact, navigable item rows. */
export const EditorItemEstimateRouteGraph = ({
	config,
	header,
	projectId,
	routeSteps,
}: {
	readonly config: EditorProject["config"];
	readonly header: ReactNode;
	readonly projectId: string;
	readonly routeSteps: ReadonlyArray<EditorItemEstimateRouteStep>;
}) => {
	const [sort, setSort] = useState<EditorItemEstimateSort>("time");
	const requiredByOccurrenceId = new Map<string, Set<string>>();
	for (const route of routeSteps)
		for (const requirement of route.requirements) {
			if (requirement.acquisitionOccurrenceId === undefined) continue;
			const requiredBy =
				requiredByOccurrenceId.get(requirement.acquisitionOccurrenceId) ??
				new Set<string>();
			requiredBy.add(route.factId);
			requiredByOccurrenceId.set(requirement.acquisitionOccurrenceId, requiredBy);
		}
	const sortedRouteSteps = [
		...routeSteps,
	].sort((left, right) => {
		const difference =
			sort === "time" ? right.durationMs - left.durationMs : right.quantity - left.quantity;
		if (Math.abs(difference) > 1e-9) return difference;
		const leftTitle = config.items[left.factId]?.title ?? left.factId;
		const rightTitle = config.items[right.factId]?.title ?? right.factId;
		return leftTitle.localeCompare(rightTitle) || left.factId.localeCompare(right.factId);
	});
	return (
		<div className="grid gap-3">
			<article
				className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised p-4"
				data-ui="EditorItemEstimateHeader"
			>
				{header}
				<div className="inline-flex shrink-0 rounded-lg border border-line bg-surface p-1">
					{(
						[
							"time",
							"quantity",
						] as const
					).map((value) => (
						<button
							className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-semibold ${sort === value ? selectableActiveClassName : selectableInactiveClassName}`}
							key={value}
							onClick={() => setSort(value)}
							type="button"
						>
							{value === "time" ? "Time" : "Quantity"}
						</button>
					))}
				</div>
			</article>
			<div
				className="ak-list grid min-h-0 gap-2 overflow-y-auto pr-1"
				data-ui="EditorItemEstimateBreakdown"
			>
				{sortedRouteSteps.map((route) => {
					const item = config.items[route.factId];
					return (
						<article
							className={`ak-list-row flex min-h-16 min-w-0 items-center justify-between gap-4 rounded-xl p-3 text-sm ${item === undefined ? "" : "ak-list-row-interactive"}`}
							data-ui="EditorItemEstimateRouteStep"
							key={route.occurrenceId}
						>
							<div className="min-w-0 flex-1">
								{item === undefined ? (
									<span
										className="block truncate font-medium text-muted"
										title={route.factId}
									>
										{route.factId} [missing]
									</span>
								) : (
									<EditorItemDetailReference
										item={item}
										projectId={projectId}
										sectionId="estimate"
										stretched
									/>
								)}
								{route.rootQuantity > 0 ? (
									<p className="mt-1 truncate text-xs text-muted">
										{formatQuantity(route.rootQuantity)} from authored start
									</p>
								) : null}
								{route.occurrenceCount > 1 ? (
									<p className="mt-1 truncate text-xs text-muted">
										{formatQuantity(route.occurrenceCount)} equivalent
										occurrences
									</p>
								) : null}
								{requiredByOccurrenceId.get(route.occurrenceId)?.size ? (
									<p className="mt-1 truncate text-xs text-muted">
										Required by:{" "}
										{[
											...requiredByOccurrenceId.get(route.occurrenceId)!,
										]
											.map((factId) => config.items[factId]?.title ?? factId)
											.sort()
											.join(", ")}
									</p>
								) : null}
							</div>
							<dl className="pointer-events-none relative z-10 grid shrink-0 gap-1 text-right tabular-nums">
								<div className="flex items-baseline justify-end gap-1.5">
									<dt className="text-xs text-muted">
										{route.occurrenceCount > 1 ? "Quantity each:" : "Quantity:"}
									</dt>
									<dd className="font-semibold text-foreground">
										×{formatQuantity(route.quantity)}
									</dd>
								</div>
								<div className="flex items-baseline justify-end gap-1.5">
									<dt className="text-xs text-muted">Time:</dt>
									<dd className="font-semibold text-foreground">
										{formatRuntime(route.durationMs)}
									</dd>
								</div>
							</dl>
						</article>
					);
				})}
			</div>
		</div>
	);
};
