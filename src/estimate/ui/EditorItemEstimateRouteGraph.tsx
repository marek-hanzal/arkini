import type { EditorProject } from "~/project-authoring/type/EditorProject";
import type { EstimateRouteStep } from "~/estimate-projection/type/EstimateProjection";
import { type ReactNode, useState } from "react";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { selectableClassName } from "~/ui/constant/SelectableStateClassName";
import { EditorItemDetailReference } from "~/item-authoring/ui/EditorItemDetailReference";

const formatQuantityFn = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const formatRuntimeFn = (runtimeMs: number) => formatDurationFn(runtimeMs);

type EditorItemEstimateSort = "quantity" | "time";

/** Presents the normalized selected-fact route DAG as compact, navigable item rows. */
export const EditorItemEstimateRouteGraph = ({
	config,
	header,
	projectId,
	routeSteps,
}: {
	readonly config: EditorProject["config"];
	readonly header: ReactNode;
	readonly projectId: string;
	readonly routeSteps: ReadonlyArray<EstimateRouteStep>;
}) => {
	const [sort, setSort] = useState<EditorItemEstimateSort>("time");
	const requiredByFactId = new Map<string, Set<string>>();
	for (const route of routeSteps)
		for (const requirement of route.requirements) {
			if (requirement.acquisitionFactId === undefined) continue;
			const requiredBy =
				requiredByFactId.get(requirement.acquisitionFactId) ?? new Set<string>();
			requiredBy.add(route.factId);
			requiredByFactId.set(requirement.acquisitionFactId, requiredBy);
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
							className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-semibold ${selectableClassName}`}
							key={value}
							onClick={() => setSort(value)}
							type="button"
							{...readDataUiFn({
								dataUi: "EditorItemEstimateRouteSort",
								state: {
									selected: sort === value,
								},
							})}
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
							className="ak-list-row ak-list-row-interactive flex min-h-16 min-w-0 items-center justify-between gap-4 rounded-xl p-3 text-sm"
							key={route.factId}
							{...readDataUiFn({
								dataUi: "EditorItemEstimateRouteStep",
								state: {
									enabled: item !== undefined,
								},
							})}
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
										{formatQuantityFn(route.rootQuantity)} from authored start
									</p>
								) : null}
								{requiredByFactId.get(route.factId)?.size ? (
									<p className="mt-1 truncate text-xs text-muted">
										Required by:{" "}
										{[
											...requiredByFactId.get(route.factId)!,
										]
											.map((factId) => config.items[factId]?.title ?? factId)
											.sort()
											.join(", ")}
									</p>
								) : null}
							</div>
							<dl className="pointer-events-none relative z-10 grid shrink-0 gap-1 text-right tabular-nums">
								<div className="flex items-baseline justify-end gap-1.5">
									<dt className="text-xs text-muted">Quantity:</dt>
									<dd className="font-semibold text-foreground">
										×{formatQuantityFn(route.quantity)}
									</dd>
								</div>
								<div className="flex items-baseline justify-end gap-1.5">
									<dt className="text-xs text-muted">Time:</dt>
									<dd className="font-semibold text-foreground">
										{formatRuntimeFn(route.durationMs)}
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
