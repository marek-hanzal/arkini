import { TriangleAlert } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { ItemEstimateViewSchema } from "~/estimate/schema/ItemEstimateViewSchema";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSelect, type EditorSelectOption } from "~/editor-control/ui/EditorSelect";
import { ItemEstimateListRow } from "~/estimate/ui/ItemEstimateListRow";
import { ItemEstimateLoading } from "~/estimate/ui/ItemEstimateLoading";
import { useItemEstimateIndex } from "~/estimate/ui/useItemEstimateIndex";
import { Status } from "~/ui/ui/Status";

const EstimateViewOptions: ReadonlyArray<EditorSelectOption<ItemEstimateViewSchema.Type>> = [
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
	{
		label: "Incomplete only",
		value: "incomplete",
	},
];

/** Lists all static item estimates without analyzing the authored graph on the renderer thread. */
export const ItemEstimateList = ({
	onQueryChangeFn,
	onViewChangeFn,
	query,
	view,
}: {
	readonly onQueryChangeFn: (query: string) => void;
	readonly onViewChangeFn: (view: ItemEstimateViewSchema.Type) => void;
	readonly query: string;
	readonly view: ItemEstimateViewSchema.Type;
}) => {
	const project = useEditorProject();
	const state = useItemEstimateIndex(project, {
		query,
		view,
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
					onChange={(event) => onQueryChangeFn(event.currentTarget.value)}
				/>
				<EditorSelect
					label="View item estimates"
					onChangeFn={onViewChangeFn}
					options={EstimateViewOptions}
					value={view}
				/>
			</header>
			<div className="ak-list grid content-start gap-2 px-3 pt-3 pb-3">
				{state.status === "loading" ? <ItemEstimateLoading catalog /> : null}
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
