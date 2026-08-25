import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorItemEstimateSortSchema } from "~/editor/EditorItemEstimateSortSchema";
import { EditorHistoryBackButton } from "~/ui/editor/EditorHistoryBackButton";
import { EditorSelect, type EditorSelectOption } from "~/ui/form/EditorSelect";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";
import { EditorItemEstimateListRow } from "~/ui/item/editor/EditorItemEstimateListRow";
import { useEditorItemEstimateIndex } from "~/ui/item/editor/useEditorItemEstimateIndex";
import { Status } from "~/ui/status/Status";

const EstimateSortOptions: ReadonlyArray<EditorSelectOption<EditorItemEstimateSortSchema.Type>> = [
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
export const EditorItemEstimateList = ({
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
	readonly onSortChange: (sort: EditorItemEstimateSortSchema.Type) => void;
	readonly query: string;
	readonly sort: EditorItemEstimateSortSchema.Type;
}) => {
	const project = useEditorProject();
	const state = useEditorItemEstimateIndex(project, {
		incomplete,
		query,
		sort,
	});
	return (
		<section
			className="h-full min-h-0 overflow-y-auto overscroll-contain"
			data-scroll-restoration-id="editor-estimate-list"
			aria-label="Item estimates"
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
					aria-label="Search item estimates"
					onChange={(event) => onQueryChange(event.currentTarget.value)}
				/>
				<button
					type="button"
					className={`min-h-[var(--ak-control-min-height)] cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold ${incomplete ? selectableActiveClassName : selectableInactiveClassName}`}
					data-selected={incomplete}
					data-ui="EditorItemEstimateIncompleteFilter"
					onClick={() => onIncompleteChange(!incomplete)}
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
						icon="icon-[lucide--triangle-alert]"
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
					<EditorItemEstimateListRow
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
