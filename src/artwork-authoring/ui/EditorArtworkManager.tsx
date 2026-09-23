import { Tx } from "~/translation/ui/Tx";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { ArtworkCardLink } from "~/ui/ui/ArtworkCardLink";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import {
	EditorSectionBar,
	EditorSectionShortcutNavigation,
} from "~/authoring-shell/ui/EditorSectionBar";
import { Mx } from "~/translation/ui/Mx";
import { FloatingPortal } from "@floating-ui/react";
import {
	BadgeCheck,
	ChevronDown,
	CircleAlert,
	Image as ImageIcon,
	ImageOff,
	Images,
	type LucideIcon,
	NotebookPen,
	PackageOpen,
	SearchX,
	Sparkles,
} from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { EditorVirtualCollection } from "~/editor-control/ui/EditorVirtualCollection";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { useEditorFloatingMenu } from "~/authoring-shell/ui/useEditorFloatingMenu";
import type { Project } from "~/project-authoring/type/Project";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";
import { useEditorArtworkManagerController } from "~/artwork-authoring/ui/useEditorArtworkManagerController";
import { Status } from "~/ui/ui/Status";
import { SearchInput } from "~/ui/ui/SearchInput";
import { useDebouncedSearchQuery } from "~/ui/ui/useDebouncedSearchQuery";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { LinkButton } from "~/ui/ui/LinkButton";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface EditorArtworkManagerProps extends useEditorArtworkManagerController.Props {
	readonly onFilterChangeFn: (filter: useEditorArtworkManagerController.Filter) => void;
	readonly onQueryChangeFn: (query: string) => void;
}

interface EditorArtworkImportMenuProps {
	readonly onImportSerapackFn: () => void;
	readonly onImportFilesFn: () => void;
	readonly pending: boolean;
}

interface EditorArtworkOptimizationAlertProps {
	readonly message: string;
	readonly onDismissFn: () => void;
	readonly tone: "danger" | "success";
}

const artworkFilters = [
	{
		icon: Images,
		label: "All",
		value: "all",
		shortcut: "a",
	},
	{
		icon: ImageOff,
		label: "Unused",
		value: "unused",
		shortcut: "u",
	},
	{
		icon: NotebookPen,
		label: "With note",
		value: "with-note",
		shortcut: "w",
	},
] as const satisfies ReadonlyArray<{
	readonly label: string;
	readonly shortcut: string;
	readonly icon: LucideIcon;
	readonly value: useEditorArtworkManagerController.Filter;
}>;

const artworkCatalogStatuses = {
	empty: {
		dataUi: "EditorArtworkEmpty",
		description: "Import artwork from an serapack or select PNG files to start the library.",
		icon: Images,
		title: "No artwork yet",
	},
	"no-matches": {
		dataUi: "EditorArtworkFilteredEmpty",
		description: "Try a different search or change the active filters.",
		icon: SearchX,
		title: "No matching artwork",
	},
	"unused-empty": {
		dataUi: "EditorArtworkFilteredEmpty",
		description: "Every artwork is referenced by the current project.",
		icon: BadgeCheck,
		title: "No unused artwork",
	},
} as const satisfies Record<
	useEditorArtworkManagerController.CatalogState,
	{
		readonly dataUi: string;
		readonly description: string;
		readonly icon: LucideIcon;
		readonly title: string;
	}
>;

const EditorArtworkImportMenu = ({
	onImportSerapackFn,
	onImportFilesFn,
	pending,
}: EditorArtworkImportMenuProps) => {
	const {
		floatingStyles,
		getFloatingProps: getFloatingPropsFn,
		getReferenceProps: getReferencePropsFn,
		open,
		refs,
		setOpenFn,
	} = useEditorFloatingMenu();
	const runImportFn = (importResourcesFn: () => void) => {
		setOpenFn(false);
		importResourcesFn();
	};

	return (
		<>
			<div
				className="inline-flex h-10 min-h-0 shrink-0 overflow-hidden rounded-lg shadow-lg"
				data-ui="EditorArtworkImportControl"
			>
				<PrimaryButton
					className="h-10 min-h-0 gap-2 rounded-r-none px-3 py-0 text-sm shadow-none"
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorArtworkImport"
					disabled={pending}
					onClick={onImportSerapackFn}
				>
					<PackageOpen className="size-4" />
					<Tx label="Import artwork" />
				</PrimaryButton>
				<PrimaryButton
					ref={refs.setReference}
					className="size-10 min-h-0 min-w-0 rounded-l-none border-l border-accent-contrast/25 p-0 shadow-none"
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorArtworkImportMenuTrigger"
					disabled={pending}
					{...getReferencePropsFn()}
				>
					<ChevronDown className="size-4" />
				</PrimaryButton>
			</div>
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						style={floatingStyles}
						className="z-50 grid w-80 max-w-[calc(100vw-1rem)] gap-1 rounded-xl border border-line-strong bg-surface p-1.5 shadow-2xl"
						data-ui="EditorArtworkImportMenu"
						{...getFloatingPropsFn()}
					>
						<Button
							className="min-h-0 justify-start gap-3 border-0 bg-transparent px-2.5 py-2 text-left shadow-none"
							data-ui="EditorArtworkImportSerapackOption"
							onClick={() => runImportFn(onImportSerapackFn)}
						>
							<PackageOpen className="size-5 shrink-0 text-accent" />
							<span>
								<span className="block font-semibold">
									<Tx label="From Serapack" />
								</span>
								<span className="mt-0.5 block text-xs font-normal leading-4 text-muted">
									<Tx label="Artwork Serapack import summary" />
								</span>
							</span>
						</Button>
						<Button
							className="min-h-0 justify-start gap-3 border-0 bg-transparent px-2.5 py-2 text-left shadow-none"
							data-ui="EditorArtworkImportFilesOption"
							onClick={() => runImportFn(onImportFilesFn)}
						>
							<Images className="size-5 shrink-0 text-accent" />
							<span>
								<span className="block font-semibold">
									<Tx label="PNG files" />
								</span>
								<span className="mt-0.5 block text-xs font-normal leading-4 text-muted">
									<Tx label="Artwork PNG import summary" />
								</span>
							</span>
						</Button>
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};

const EditorArtworkOptimizationAlert = ({
	message,
	onDismissFn,
	tone,
}: EditorArtworkOptimizationAlertProps) => (
	<div
		className="mb-3 flex min-h-12 items-center gap-3 rounded-xl border-l-2 bg-surface-raised/60 px-4 py-3 text-sm data-[ui-tone=danger]:border-danger data-[ui-tone=danger]:bg-danger/10 data-[ui-tone=success]:border-success data-[ui-tone=success]:bg-success/10"
		{...readDataUiFn({
			dataUi: "EditorArtworkOptimizeAlert",
			state: {
				tone,
			},
		})}
	>
		{tone === "success" ? (
			<BadgeCheck className="size-5 shrink-0 text-success" />
		) : (
			<CircleAlert className="size-5 shrink-0 text-danger" />
		)}
		<p className="min-w-0 flex-1">{message}</p>
		<LinkButton
			className="shrink-0"
			data-ui="EditorArtworkOptimizeAlertDismiss"
			onClick={onDismissFn}
		>
			<Tx label="Dismiss" />
		</LinkButton>
	</div>
);

const EditorArtworkCard = ({
	filter,
	query,
	resource,
	unused,
}: {
	readonly filter: ArtworkCatalogFilterSchema.Type;
	readonly query: string;
	readonly resource: Project.Resource;
	readonly unused: boolean;
}) => {
	const translator = useTranslator();
	const project = useEditorProject();
	const url = useResourceUrl(resource.uid);
	return (
		<ArtworkCardLink
			to="/editor/$projectId/artwork/$resourceUid/detail/overview"
			params={{
				projectId: project.projectId,
				resourceUid: resource.uid,
			}}
			search={{
				filter,
				query,
			}}
			preload="intent"
			className="data-[ui-unused=true]:bg-accent/10 data-[ui-unused=true]:hover:bg-accent/15"
			{...readDataUiFn({
				dataUi: "EditorArtworkCard",
				state: {
					unused,
				},
			})}
			label={resource.title}
			cornerEnd={
				unused ? (
					<span
						className="rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
						data-ui="EditorArtworkUsageBadge"
					>
						{translator.textFn("Unused")}
					</span>
				) : undefined
			}
			artwork={
				<span className="relative grid aspect-square w-66 max-w-full place-items-center">
					{url === undefined ? (
						<ImageIcon className="size-8 text-subtle" />
					) : (
						<img
							src={url}
							alt=""
							className="absolute inset-0 size-full object-contain"
							draggable={false}
							loading="lazy"
						/>
					)}
				</span>
			}
		/>
	);
};

interface EditorArtworkGridProps {
	readonly filter: ArtworkCatalogFilterSchema.Type;
	readonly query: string;
	readonly resources: Project["resources"];
}

const readArtworkKeyFn = (resource: Project["resources"][number]) => resource.uid;

const EditorArtworkGrid = memo(({ filter, query, resources }: EditorArtworkGridProps) => {
	const project = useEditorProject();
	const usedResourceUids = useMemo(
		() =>
			new Set(readGameResourceUsagesFn(project.config).map(({ resourceUid }) => resourceUid)),
		[
			project.config,
		],
	);
	const renderArtworkFn = useCallback(
		(resource: Project["resources"][number]) => (
			<EditorArtworkCard
				filter={filter}
				query={query}
				resource={resource}
				unused={!usedResourceUids.has(resource.uid)}
			/>
		),
		[
			filter,
			query,
			usedResourceUids,
		],
	);
	return (
		<EditorVirtualCollection
			items={resources}
			itemKeyFn={readArtworkKeyFn}
			renderItemFn={renderArtworkFn}
			estimatedRowHeight={332}
			gapRem={0.75}
			minColumnWidthRem={19}
		/>
	);
});

export const EditorArtworkManager = (props: EditorArtworkManagerProps) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const settledQuery = useDebouncedSearchQuery(props.query);
	const controller = useEditorArtworkManagerController({
		filter: props.filter,
		query: settledQuery,
	});
	const catalogStatus =
		controller.catalogState === undefined
			? undefined
			: artworkCatalogStatuses[controller.catalogState];
	const importError =
		controller.importError === undefined
			? undefined
			: controller.importError instanceof Error
				? controller.importError.message
				: String(controller.importError);
	const importSuccess =
		controller.importedCount === undefined
			? undefined
			: `${translator.textFn("Imported artwork")}: ${controller.importedCount}`;
	const optimizeError =
		controller.optimizeError === undefined
			? undefined
			: controller.optimizeError instanceof Error
				? controller.optimizeError.message
				: String(controller.optimizeError);
	const optimizationSuccess =
		controller.optimization === undefined
			? undefined
			: controller.optimization.optimizedResourceCount === 0
				? `${translator.textFn("Already optimized")}: ${controller.optimization.processedResourceCount} PNG`
				: `${translator.textFn("Optimized")}: ${controller.optimization.optimizedResourceCount}/${controller.optimization.processedResourceCount} PNG · ${formatByteSizeFn(Math.abs(controller.optimization.originalBytes - controller.optimization.optimizedBytes))} ${translator.textFn(controller.optimization.optimizedBytes <= controller.optimization.originalBytes ? "saved" : "added by invisible color cleanup")}`;
	const optimizationAlert =
		optimizeError === undefined
			? optimizationSuccess === undefined
				? undefined
				: {
						message: optimizationSuccess,
						tone: "success" as const,
					}
			: {
					message: optimizeError,
					tone: "danger" as const,
				};
	const busy = controller.importPending || controller.optimizePending;
	const optimizationPercent =
		controller.optimizationProgress === undefined ||
		controller.optimizationProgress.totalResourceCount === 0
			? 0
			: controller.optimizationProgress.phase === "saving"
				? 100
				: Math.min(
						95,
						Math.round(
							(controller.optimizationProgress.completedResourceCount /
								controller.optimizationProgress.totalResourceCount) *
								95,
						),
					);
	const importButton = (
		<EditorArtworkImportMenu
			onImportSerapackFn={controller.openSerapackImportFn}
			onImportFilesFn={controller.openFilesImportFn}
			pending={busy}
		/>
	);

	return (
		<EditorSectionPage
			fillContent={catalogStatus !== undefined}
			header={
				<header className="flex min-w-0 flex-wrap items-center gap-2">
					<EditorHistoryBackButton
						params={{
							projectId: project.projectId,
						}}
						to="/editor/$projectId/editor/items/list"
					/>
					<input
						ref={controller.serapackInputRef}
						type="file"
						accept=".serapack"
						className="hidden"
						data-ui="EditorArtworkSerapackInput"
						disabled={busy}
						onChange={controller.onSerapackChangeFn}
					/>
					<input
						ref={controller.filesInputRef}
						type="file"
						accept="image/png,.png"
						multiple
						className="hidden"
						data-ui="EditorArtworkImportInput"
						disabled={busy}
						onChange={controller.onFilesChangeFn}
					/>
					<SearchInput
						value={props.query}
						containerClassName="min-w-64 flex-1"
						className="h-10 min-h-10 w-full rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 text-sm text-foreground outline-none placeholder:text-muted"
						data-ui="EditorArtworkSearch"
						placeholder={`${translator.textFn("Search artwork…")} (${controller.resources.length})`}
						onValueChangeFn={props.onQueryChangeFn}
					/>
					{controller.catalogState === "empty" ? null : importButton}
				</header>
			}
			secondaryNavigation={
				<EditorSectionBar
					actions={
						<LinkButton
							className="inline-flex min-w-28 shrink-0 items-center justify-end gap-1.5 whitespace-nowrap"
							cursorIntent={busy ? "progress" : undefined}
							data-ui="EditorArtworkOptimize"
							disabled={busy || controller.resources.length === 0}
							onClick={controller.onOptimizeFn}
						>
							<Sparkles className="size-4" />
							{controller.optimizePending
								? controller.optimizationProgress?.phase === "saving"
									? translator.textFn("Saving…")
									: `${translator.textFn("Optimizing")} ${optimizationPercent}%`
								: translator.textFn("Optimize")}
						</LinkButton>
					}
					help={
						<EditorPageHelp
							title={translator.textFn("Artwork")}
							content={<Mx label="Artwork catalog help" />}
						/>
					}
				>
					<EditorSectionShortcutNavigation
						dataUi="EditorArtworkFilter"
						onChangeFn={props.onFilterChangeFn}
						options={artworkFilters.map((option) => ({
							...option,
							label: translator.textFn(option.label),
						}))}
						value={props.filter}
					/>
				</EditorSectionBar>
			}
			scrollRestorationId="editor-artwork-list"
		>
			<div
				className="flex flex-1 flex-col"
				data-ui="EditorArtworkManager"
			>
				{importError === undefined ? null : (
					<p
						className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
						data-ui="EditorArtworkImportError"
					>
						{importError}
					</p>
				)}
				{importSuccess === undefined ? null : (
					<p
						className="mb-3 text-sm text-success"
						data-ui="EditorArtworkImportSuccess"
					>
						{importSuccess}
					</p>
				)}
				{optimizationAlert === undefined ? null : (
					<EditorArtworkOptimizationAlert
						message={optimizationAlert.message}
						onDismissFn={controller.onOptimizationDismissFn}
						tone={optimizationAlert.tone}
					/>
				)}
				{controller.notesLoading ? (
					<p className="mb-3 text-sm text-muted">{translator.textFn("Loading notes…")}</p>
				) : null}
				{controller.notesError === undefined ? null : (
					<p className="mb-3 text-sm text-danger">
						{translator.textFn("Could not load notes.")}
					</p>
				)}
				{catalogStatus === undefined ? null : (
					<Status
						dataUi={catalogStatus.dataUi}
						description={<Mx label={catalogStatus.description} />}
						size="large"
						variant="flat"
						icon={catalogStatus.icon}
						title={translator.textFn(catalogStatus.title)}
						action={controller.catalogState === "empty" ? importButton : undefined}
					/>
				)}
				{controller.resources.length === 0 ? null : (
					<EditorArtworkGrid
						filter={props.filter}
						query={settledQuery}
						resources={controller.resources}
					/>
				)}
			</div>
		</EditorSectionPage>
	);
};
