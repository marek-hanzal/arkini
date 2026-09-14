import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import {
	editorSectionLinkClassName,
	EditorSectionBar,
	EditorSectionShortcutNavigation,
} from "~/authoring-shell/ui/EditorSectionBar";
import { Mx } from "~/translation/ui/Mx";
import {
	ArrowDownAZ,
	CircleOff,
	FilePenLine,
	Gauge,
	Hourglass,
	NotebookPen,
	PackageOpen,
	Plus,
	RefreshCw,
	SearchX,
	TrendingUp,
	TriangleAlert,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { EditorVirtualCollection } from "~/editor-control/ui/EditorVirtualCollection";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

import { useProjectNotes } from "~/project-note/ui/useProjectNotes";
import { readDraftFn } from "~/item-authoring/fn/readDraftFn";
import { selectItemCollectionFn } from "~/item-authoring/fn/selectItemCollectionFn";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { CreateItemLink } from "~/item-authoring/ui/CreateItemLink";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { ItemEstimateMetrics } from "~/estimate/ui/ItemEstimateMetrics";
import { useItemEstimateIndex } from "~/estimate/ui/useItemEstimateIndex";
import { ArtworkCardLink } from "~/ui/ui/ArtworkCardLink";
import { Status } from "~/ui/ui/Status";
import { SearchInput } from "~/ui/ui/SearchInput";
import { useDebouncedSearchQuery } from "~/ui/ui/useDebouncedSearchQuery";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

const readItemKeyFn = (item: ItemSchema.Type) => item.uid;

/** Lists the canonical saved item registry as the editor's default workspace. */
export const List = ({
	draft,
	onDraftChangeFn,
	onQueryChangeFn,
	onViewChangeFn,
	query,
	view,
}: {
	readonly draft: boolean;
	readonly onDraftChangeFn: (draft: boolean) => void;
	readonly onQueryChangeFn: (query: string) => void;
	readonly query: string;
	readonly view: selectItemCollectionFn.View;
	readonly onViewChangeFn: (view: selectItemCollectionFn.View) => void;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const notes = useProjectNotes(project.projectId);
	const notedItemUids = useMemo(
		() => new Set(notes.notes.flatMap((note) => note.itemUids)),
		[
			notes.notes,
		],
	);
	const itemViewOptions = [
		{
			icon: ArrowDownAZ,
			label: translator.textFn("Name"),
			value: "name",
		},
		{
			icon: CircleOff,
			label: translator.textFn("Unreachable"),
			value: "incomplete",
		},
		{
			icon: Gauge,
			label: translator.textFn("Fastest first"),
			value: "fastest",
		},
		{
			icon: Hourglass,
			label: translator.textFn("Slowest first"),
			value: "slowest",
		},
		{
			icon: TrendingUp,
			label: translator.textFn("Highest demand first"),
			value: "demand",
		},
		{
			icon: NotebookPen,
			label: translator.textFn("With note"),
			value: "with-note",
		},
	] as const satisfies ReadonlyArray<{
		readonly icon: typeof ArrowDownAZ;
		readonly label: string;
		readonly value: selectItemCollectionFn.View;
	}>;

	const [refreshVersion, setRefreshVersion] = useState(0);
	const settledQuery = useDebouncedSearchQuery(query);
	const estimates = useItemEstimateIndex(project, {
		query: "",
		refreshVersion,
		view: view === "name" || view === "with-note" ? "fastest" : view,
	});
	const estimatesCurrent = estimates.snapshot.config === project.config;
	// Item editing stays live; estimates belong to the entry or manually refreshed config.
	const currentEstimateRows = useMemo(
		() => (estimatesCurrent ? estimates.rows : []),
		[
			estimates.rows,
			estimatesCurrent,
		],
	);
	const estimatesByUid = useMemo(
		() =>
			new Map(
				currentEstimateRows.map(({ item, estimate }) => [
					item.uid,
					estimate,
				]),
			),
		[
			currentEstimateRows,
		],
	);
	const items = useMemo(
		() => Object.values(project.config.items),
		[
			project.config?.items,
		],
	);
	const empty = items.length === 0;
	const filteredItems = useMemo(
		() =>
			selectItemCollectionFn({
				items,
				orderedEstimates: currentEstimateRows,
				notedItemUids,
				draft,
				query: settledQuery,
				view,
			}),
		[
			draft,
			items,
			settledQuery,
			currentEstimateRows,
			notedItemUids,
			view,
		],
	);
	const renderItemFn = useCallback(
		(item: ItemSchema.Type) => (
			<ArtworkCardLink
				to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
				params={{
					projectId: project.projectId,
					itemUid: item.uid,
					sectionId: "identity",
				}}
				preload="intent"
				className="data-[ui-highlighted=true]:bg-accent/10 data-[ui-highlighted=true]:hover:bg-accent/15"
				{...readDataUiFn({
					dataUi: "EditorItemCard",
					state: {
						draft: readDraftFn(item),
						highlighted:
							readDraftFn(item) ||
							estimatesByUid.get(item.uid)?.status === "unreachable",
					},
				})}
				data-item-id={item.id}
				data-item-uid={item.uid}
				label={item.title}
				corner={
					notedItemUids.has(item.uid) ? (
						<span title={translator.textFn("Notes")}>
							<NotebookPen className="size-5 text-accent" />
						</span>
					) : undefined
				}
				cornerEnd={
					readDraftFn(item) ? (
						<span className="rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
							{translator.textFn("Draft")}
						</span>
					) : undefined
				}
				details={
					<ItemEstimateMetrics
						estimate={estimatesByUid.get(item.uid)}
						maximumDemand={estimates.maximumDemand}
					/>
				}
				artwork={
					<EditorItemThumbnail
						className="aspect-square h-auto w-66 max-w-full rounded-none border-0 bg-transparent"
						resourceIds={item.asset.default}
					/>
				}
			/>
		),
		[
			project.projectId,
			estimatesByUid,
			estimates.maximumDemand,
			notedItemUids,
			translator,
		],
	);
	const newItemMenu = (
		<CreateItemLink
			dataUi="EditorNewItemMenu"
			defaultDraft={false}
			projectId={project.projectId}
			className="h-10 min-h-10 shrink-0 gap-2 px-3 py-2 text-sm"
			variant="primary"
		>
			<Plus className="size-4" />
			{translator.textFn("New item")}
		</CreateItemLink>
	);
	return (
		<EditorSectionPage
			fillContent={filteredItems.length === 0}
			header={
				<header className="flex min-w-0 flex-wrap items-center gap-2">
					<EditorHistoryBackButton to="/editor/welcome" />
					<SearchInput
						value={query}
						containerClassName="min-w-64 flex-1"
						className="h-10 min-h-10 w-full rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 text-sm text-foreground outline-none placeholder:text-muted"
						placeholder={`${translator.textFn("Search item title or ID…")} (${filteredItems.length})`}
						onValueChangeFn={onQueryChangeFn}
					/>
					{empty ? null : newItemMenu}
				</header>
			}
			secondaryNavigation={
				<EditorSectionBar
					actions={
						<LinkButton
							className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap opacity-60 data-[ui-stale=true]:opacity-100 hover:opacity-100"
							disabled={estimatesCurrent && estimates.status === "loading"}
							onClick={() => setRefreshVersion((version) => version + 1)}
							{...readDataUiFn({
								dataUi: "EditorItemsRefresh",
								state: {
									stale: !estimatesCurrent || estimates.status === "error",
									loading: estimatesCurrent && estimates.status === "loading",
								},
							})}
						>
							<RefreshCw className="size-4 in-data-[ui-loading=true]:animate-spin" />
							{translator.textFn("Refresh")}
						</LinkButton>
					}
					help={
						<EditorPageHelp
							title={translator.textFn("Items")}
							content={<Mx label="Item list help" />}
						/>
					}
				>
					<EditorSectionShortcutNavigation
						dataUi="EditorItemView"
						onChangeFn={onViewChangeFn}
						options={itemViewOptions}
						value={view}
					/>
					<LinkButton
						className={`${editorSectionLinkClassName} gap-1.5`}
						onClick={() => onDraftChangeFn(!draft)}
						{...readDataUiFn({
							dataUi: "EditorItemDraftFilter",
							state: {
								selected: draft,
							},
						})}
					>
						<FilePenLine className="size-4 shrink-0" />
						{translator.textFn("Draft")}
					</LinkButton>
				</EditorSectionBar>
			}
			scrollRestorationId="editor-item-list"
		>
			<div
				className="ak-list flex flex-1 flex-col gap-2"
				data-ui="EditorItemList"
			>
				{empty ? (
					<Status
						dataUi="EditorItemsEmpty"
						icon={PackageOpen}
						title={translator.textFn("No items yet")}
						description={translator.textFn(
							"Create the first item to start authoring this game.",
						)}
						size="large"
						variant="flat"
						action={newItemMenu}
					/>
				) : null}
				{view === "with-note" && notes.loading ? (
					<p className="text-sm text-muted">{translator.textFn("Loading notes…")}</p>
				) : null}
				{!empty && estimatesCurrent && estimates.status === "error" ? (
					<Status
						dataUi="EditorItemEstimatesError"
						description={estimates.message}
						icon={TriangleAlert}
						title={translator.textFn("Estimate calculation failed")}
					/>
				) : null}
				{!empty &&
				filteredItems.length === 0 &&
				(view !== "with-note" || notes.loaded) &&
				(view !== "incomplete" || (estimatesCurrent && estimates.status === "ready")) ? (
					<Status
						dataUi="EditorItemSearchEmpty"
						icon={SearchX}
						title={translator.textFn("No matching items")}
						description={translator.textFn(
							"Try a different search or change the active filters.",
						)}
						size="large"
						variant="flat"
					/>
				) : null}
				{filteredItems.length === 0 ? null : (
					<EditorVirtualCollection
						items={filteredItems}
						itemKeyFn={readItemKeyFn}
						renderItemFn={renderItemFn}
						estimatedRowHeight={352}
						gapRem={0.75}
						minColumnWidthRem={19}
					/>
				)}
			</div>
		</EditorSectionPage>
	);
};
