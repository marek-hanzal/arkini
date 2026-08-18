import { useMemo, useState } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { searchEditorItemsFx } from "~/editor/searchEditorItemsFx";
import { EditorSelect, type EditorSelectOption } from "~/ui/form/EditorSelect";
import { EditorItemEstimateListRow } from "~/ui/item/editor/EditorItemEstimateListRow";
import { useEditorItemEstimateIndex } from "~/ui/item/editor/useEditorItemEstimateIndex";
import { Status } from "~/ui/status/Status";

type EstimateSort = "demand" | "fastest" | "slowest";

const EstimateSortOptions: ReadonlyArray<EditorSelectOption<EstimateSort>> = [
	{
		label: "Fastest first",
		value: "fastest",
	},
	{
		label: "Slowest first",
		value: "slowest",
	},
	{
		label: "Highest demand first",
		value: "demand",
	},
];

const compareRuntime = (
	left: number | undefined,
	right: number | undefined,
	direction: EstimateSort,
) => {
	if (left === undefined) return right === undefined ? 0 : 1;
	if (right === undefined) return -1;
	return direction === "fastest" ? left - right : right - left;
};

/** Lists all static item estimates without analyzing the authored graph on the renderer thread. */
export const EditorItemEstimateList = () => {
	const project = useEditorProject();
	const state = useEditorItemEstimateIndex(project);
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<EstimateSort>("fastest");
	const maximumDemand = Math.max(0, ...state.entries.map(({ demand }) => demand));
	const rows = useMemo(() => {
		const estimates = new Map(
			state.entries.map((entry) => [
				entry.itemId,
				entry,
			]),
		);
		return RendererRuntime.runSync(
			searchEditorItemsFx(Object.values(project.config.items), query),
		)
			.flatMap((item) => {
				const estimate = estimates.get(item.id);
				return estimate === undefined
					? []
					: [
							{
								estimate,
								item,
							},
						];
			})
			.sort(
				(left, right) =>
					(sort === "demand"
						? right.estimate.demand - left.estimate.demand
						: compareRuntime(
								left.estimate.runtimeMs,
								right.estimate.runtimeMs,
								sort,
							)) || left.item.title.localeCompare(right.item.title),
			);
	}, [
		project.config.items,
		query,
		sort,
		state,
	]);
	return (
		<section
			className="h-full min-h-0 overflow-y-auto overscroll-contain"
			aria-label="Item estimates"
			data-ui="EditorItemEstimateList"
		>
			<header className="ak-editor-page-header flex min-w-0 flex-wrap items-center gap-2 p-3">
				<input
					type="search"
					value={query}
					className="h-12 min-w-64 flex-1 rounded-lg border border-line-strong bg-surface px-4 text-sm text-foreground outline-none placeholder:text-muted"
					placeholder="Search item title or ID…"
					aria-label="Search item estimates"
					onChange={(event) => setQuery(event.currentTarget.value)}
				/>
				<EditorSelect
					label="Sort item estimates"
					onChange={setSort}
					options={EstimateSortOptions}
					value={sort}
				/>
			</header>
			<div className="ak-list grid content-start gap-2 px-3 pt-3 pb-3">
				{state.status === "loading" ? (
					<p
						className="px-1 py-2 text-xs text-subtle"
						data-ui="EditorItemEstimatesLoading"
					>
						Calculating all item estimates…
					</p>
				) : null}
				{state.status === "error" ? (
					<Status
						dataUi="EditorItemEstimatesError"
						description={state.message}
						icon="icon-[lucide--triangle-alert]"
						title="Estimate calculation failed"
					/>
				) : null}
				{state.status !== "loading" && rows.length === 0 ? (
					<p
						className="rounded-xl border border-line bg-surface/80 p-4 text-sm text-muted"
						data-ui="EditorItemEstimateSearchEmpty"
					>
						No items match the current search.
					</p>
				) : null}
				{rows.map(({ estimate, item }) => (
					<EditorItemEstimateListRow
						estimate={estimate}
						item={item}
						key={item.uid}
						maximumDemand={maximumDemand}
						projectId={project.projectId}
					/>
				))}
			</div>
		</section>
	);
};
