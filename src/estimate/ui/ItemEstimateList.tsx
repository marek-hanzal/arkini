import { TriangleAlert } from "lucide-react";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";

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
	itemType,
	onItemTypeChangeFn,
	onQueryChangeFn,
	onViewChangeFn,
	query,
	view,
}: {
	readonly itemType?: TypeSchema.Type;
	readonly onItemTypeChangeFn: (itemType: TypeSchema.Type | undefined) => void;
	readonly onQueryChangeFn: (query: string) => void;
	readonly onViewChangeFn: (view: ItemEstimateViewSchema.Type) => void;
	readonly query: string;
	readonly view: ItemEstimateViewSchema.Type;
}) => {
	const project = useEditorProject();
	const state = useItemEstimateIndex(project, {
		itemType,
		query,
		view,
	});
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
					{itemType === undefined ? null : (
						<button
							type="button"
							className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface-raised px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-foreground"
							data-ui="EditorItemTypeFilter"
							onClick={() => onItemTypeChangeFn(undefined)}
						>
							{itemType}
							<span>×</span>
						</button>
					)}
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
				{state.rows.map(({ estimate, item }) => (
					<ItemEstimateListRow
						activeType={itemType}
						estimate={estimate}
						item={item}
						key={item.uid}
						maximumDemand={state.maximumDemand}
						onSelectTypeFn={onItemTypeChangeFn}
						projectId={project.projectId}
					/>
				))}
			</div>
		</EditorSectionPage>
	);
};
