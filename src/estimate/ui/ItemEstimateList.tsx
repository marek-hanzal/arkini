import { TriangleAlert } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { ItemEstimateSortSchema } from "~/estimate/schema/ItemEstimateSortSchema";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { EditorSelect, type EditorSelectOption } from "~/editor-control/ui/EditorSelect";
import { selectableClassName } from "~/ui/constant/SelectableStateClassName";
import { ItemEstimateListRow } from "~/estimate/ui/ItemEstimateListRow";
import { useItemEstimateIndex } from "~/estimate/ui/useItemEstimateIndex";
import { Status } from "~/ui/ui/Status";

const EstimateSortOptions: ReadonlyArray<EditorSelectOption<ItemEstimateSortSchema.Type>> = [
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

/** Lists all static item estimates without analyzing the authored graph on the renderer thread. */
export const ItemEstimateList = ({
	incomplete,
	onIncompleteChange,
	onQueryChange,
	onSortChange,
	query,
	sort,
}: {
	readonly incomplete: boolean;
	readonly onIncompleteChange: (incomplete: boolean) => void;
	readonly onQueryChange: (query: string) => void;
	readonly onSortChange: (sort: ItemEstimateSortSchema.Type) => void;
	readonly query: string;
	readonly sort: ItemEstimateSortSchema.Type;
}) => {
	const project = useEditorProject();
	const state = useItemEstimateIndex(project, {
		incomplete,
		query,
		sort,
	});
	return (
		<section
			className="h-full min-h-0 overflow-y-auto overscroll-contain"
			data-scroll-restoration-id="editor-estimate-list"
			data-ui="EditorItemEstimateList"
		>
			<header className="ak-editor-page-header flex min-w-0 flex-wrap items-center gap-2 p-3">
				<EditorHistoryBackButton
					params={{
						projectId: project.projectId,
					}}
					to="/editor/$projectId/editor/items/list"
				/>
				<input
					type="search"
					value={query}
					className="h-12 min-w-64 flex-1 rounded-lg border border-line-strong bg-surface px-4 text-sm text-foreground outline-none placeholder:text-muted"
					placeholder="Search item title or ID…"
					onChange={(event) => onQueryChange(event.currentTarget.value)}
				/>
				<button
					type="button"
					className={`min-h-[var(--ak-control-min-height)] cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold ${selectableClassName}`}
					onClick={() => onIncompleteChange(!incomplete)}
					{...readDataUiFn({
						dataUi: "EditorItemEstimateIncompleteFilter",
						state: {
							selected: incomplete,
						},
					})}
				>
					Incomplete
				</button>
				<EditorSelect
					label="Sort item estimates"
					onChange={onSortChange}
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
						icon={TriangleAlert}
						title="Estimate calculation failed"
					/>
				) : null}
				{state.status !== "loading" && state.rows.length === 0 ? (
					<p
						className="rounded-xl border border-line bg-surface/80 p-4 text-sm text-muted"
						data-ui="EditorItemEstimateSearchEmpty"
					>
						No item estimates match the current filters.
					</p>
				) : null}
				{state.rows.map(({ estimate, item }) => (
					<ItemEstimateListRow
						estimate={estimate}
						item={item}
						key={item.uid}
						maximumDemand={state.maximumDemand}
						projectId={project.projectId}
					/>
				))}
			</div>
		</section>
	);
};
