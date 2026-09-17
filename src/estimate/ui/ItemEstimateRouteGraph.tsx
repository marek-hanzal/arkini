import { formatForDisplay } from "@tanstack/react-hotkeys";
import { useEditorSectionShortcuts } from "~/authoring-shell/ui/useEditorSectionShortcuts";
import { Tx } from "~/translation/ui/Tx";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type { Project } from "~/project-authoring/type/Project";
import type { EstimateRouteStep } from "~/estimate/type/EstimateProjection";
import { type ReactNode, useState } from "react";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";
import { useTranslator } from "~/translation/ui/useTranslator";

const formatQuantityFn = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const formatRuntimeFn = (runtimeMs: number) => formatDurationFn(runtimeMs);

type ItemEstimateSort = "quantity" | "time";

/** Presents the normalized selected-fact route DAG as compact, navigable item rows. */
export const ItemEstimateRouteGraph = ({
	config,
	header,
	routeSteps,
	limit,
}: {
	readonly config: Project["config"];
	readonly header: ReactNode;
	readonly limit?: number;
	readonly routeSteps: ReadonlyArray<EstimateRouteStep>;
}) => {
	const translator = useTranslator();
	const [sort, setSortFn] = useState<ItemEstimateSort>("time");
	// Item Detail owns every letter in Time, including E for Edit; nested sorting uses Shift.
	const sortOptions = [
		{
			label: translator.textFn("Time"),
			value: "time",
			shortcut: "t",
			shift: true,
		},
		{
			label: translator.textFn("Quantity"),
			value: "quantity",
			shortcut: "q",
			shift: true,
		},
	] as const;
	useEditorSectionShortcuts({
		options: sortOptions,
		onSelectFn: (option) => setSortFn(option.value),
	});
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
			<EditorRootCard
				className="flex flex-wrap items-center justify-between gap-3"
				dataUi="EditorItemEstimateHeader"
			>
				{header}
				<SegmentedControl
					dataUi="EditorItemEstimateRouteSortOptions"
					onChangeFn={setSortFn}
					optionDataUi="EditorItemEstimateRouteSort"
					options={sortOptions.map((option) => ({
						...option,
						description: `${option.label} · ${formatForDisplay({
							key: option.shortcut,
							shift: option.shift,
						})}`,
					}))}
					size="compact"
					value={sort}
				/>
			</EditorRootCard>
			<div
				className="ak-list grid min-h-0 gap-2 overflow-y-auto pr-1"
				data-ui="EditorItemEstimateBreakdown"
			>
				{sortedRouteSteps.slice(0, limit).map((route) => {
					const item = config.items[route.factId];
					return (
						<article
							className="ak-list-row ak-list-row-interactive flex min-h-16 min-w-0 items-center justify-between gap-4 p-3 text-sm"
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
										{route.factId} {translator.textFn("Missing item marker")}
									</span>
								) : (
									<DetailReference
										itemId={route.factId}
										sectionId="estimate"
										stretched
									/>
								)}
								{route.rootQuantity > 0 ? (
									<p className="mt-1 truncate text-xs text-muted">
										{formatQuantityFn(route.rootQuantity)}{" "}
										{translator.textFn("from authored start")}
									</p>
								) : null}
							</div>
							<dl className="pointer-events-none relative z-10 grid shrink-0 gap-1 text-right tabular-nums">
								<div className="flex items-baseline justify-end gap-1.5">
									<dt className="text-xs text-muted">
										<Tx label="Quantity" />:
									</dt>
									<dd className="font-semibold text-foreground">
										×{formatQuantityFn(route.quantity)}
									</dd>
								</div>
								<div className="flex items-baseline justify-end gap-1.5">
									<dt className="text-xs text-muted">
										<Tx label="Time" />:
									</dt>
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
