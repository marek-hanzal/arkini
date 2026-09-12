import { TriangleAlert } from "lucide-react";
import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { ItemEstimateViewSchema } from "~/estimate/schema/ItemEstimateViewSchema";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSelect, type EditorSelectOption } from "~/editor-control/ui/EditorSelect";
import { ItemEstimateListRow } from "~/estimate/ui/ItemEstimateListRow";
import { ItemEstimateLoading } from "~/estimate/ui/ItemEstimateLoading";
import { useItemEstimateIndex } from "~/estimate/ui/useItemEstimateIndex";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { Status } from "~/ui/ui/Status";
import { SearchInput } from "~/ui/ui/SearchInput";
import { useDebouncedSearchQuery } from "~/ui/ui/useDebouncedSearchQuery";

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
	const settledQuery = useDebouncedSearchQuery(query);
	const state = useItemEstimateIndex(project, {
		query: settledQuery,
		view,
	});
	const rows = useMemo(
		() =>
			state.rows.map(({ estimate, item }) => (
				<ItemEstimateListRow
					estimate={estimate}
					item={item}
					key={item.uid}
					maximumDemand={state.maximumDemand}
					projectId={project.projectId}
				/>
			)),
		[
			project.projectId,
			state.maximumDemand,
			state.rows,
		],
	);
	return (
		<EditorSectionPage
			header={
				<header className="flex min-w-0 flex-wrap items-center gap-2">
					<EditorHistoryBackButton
						params={{
							projectId: project.projectId,
						}}
						to="/editor/$projectId/editor/items/list"
					/>
					<SearchInput
						value={query}
						containerClassName="min-w-64 flex-1"
						className="h-12 w-full rounded-lg border border-line-strong bg-surface px-4 text-sm text-foreground outline-none placeholder:text-muted"
						placeholder="Search item title or ID…"
						onValueChangeFn={onQueryChangeFn}
					/>

					<EditorSelect
						label="View item estimates"
						onChangeFn={onViewChangeFn}
						options={EstimateViewOptions}
						value={view}
					/>
					<EditorPageHelp
						content={<Mx label="Global estimate help" />}
						title={<Tx label="Estimate" />}
					/>
				</header>
			}
			scrollRestorationId="editor-estimate-list"
		>
			<div
				className="ak-list grid content-start gap-2"
				data-ui="EditorItemEstimateList"
			>
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
				{rows}
			</div>
		</EditorSectionPage>
	);
};
