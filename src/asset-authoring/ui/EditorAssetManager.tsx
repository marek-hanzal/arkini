import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { Mx } from "~/translation/ui/Mx";
import { FloatingPortal } from "@floating-ui/react";
import {
	BadgeCheck,
	ChevronDown,
	CircleAlert,
	Image as ImageIcon,
	Images,
	type LucideIcon,
	PackageOpen,
	SearchX,
	Sparkles,
} from "lucide-react";
import { memo, useCallback } from "react";
import { EditorVirtualCollection } from "~/editor-control/ui/EditorVirtualCollection";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { useEditorFloatingMenu } from "~/authoring-shell/ui/useEditorFloatingMenu";
import type { Project } from "~/project-authoring/type/Project";
import { Button, ButtonLink, PrimaryButton } from "~/ui/ui/Button";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";
import { useEditorAssetManagerController } from "~/asset-authoring/ui/useEditorAssetManagerController";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";
import { Status } from "~/ui/ui/Status";
import { SearchInput } from "~/ui/ui/SearchInput";
import { useDebouncedSearchQuery } from "~/ui/ui/useDebouncedSearchQuery";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { LinkButton } from "~/ui/ui/LinkButton";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface EditorAssetManagerProps extends useEditorAssetManagerController.Props {
	readonly onFilterChangeFn: (filter: useEditorAssetManagerController.Filter) => void;
	readonly onQueryChangeFn: (query: string) => void;
}

interface EditorAssetImportMenuProps {
	readonly onImportArkpackFn: () => void;
	readonly onImportFilesFn: () => void;
	readonly pending: boolean;
}

interface EditorAssetOptimizationAlertProps {
	readonly message: string;
	readonly onDismissFn: () => void;
	readonly tone: "danger" | "success";
}

const assetFilters = [
	{
		label: "All",
		value: "all",
	},
	{
		label: "Unused assets",
		value: "unused",
	},
] as const satisfies ReadonlyArray<{
	readonly label: string;
	readonly value: useEditorAssetManagerController.Filter;
}>;

const assetCatalogStatuses = {
	empty: {
		dataUi: "EditorAssetsEmpty",
		description: "Import assets from an arkpack or select PNG files to start the library.",
		icon: Images,
		title: "No assets yet",
	},
	"no-matches": {
		dataUi: "EditorAssetsFilteredEmpty",
		description: "No assets match the current search and usage filter.",
		icon: SearchX,
		title: "No matching assets",
	},
	"unused-empty": {
		dataUi: "EditorAssetsFilteredEmpty",
		description: "Every asset is referenced by the current project.",
		icon: BadgeCheck,
		title: "No unused assets",
	},
} as const satisfies Record<
	useEditorAssetManagerController.CatalogState,
	{
		readonly dataUi: string;
		readonly description: string;
		readonly icon: LucideIcon;
		readonly title: string;
	}
>;

const EditorAssetImportMenu = ({
	onImportArkpackFn,
	onImportFilesFn,
	pending,
}: EditorAssetImportMenuProps) => {
	const {
		floatingStyles,
		getFloatingProps: getFloatingPropsFn,
		getReferenceProps: getReferencePropsFn,
		open,
		refs,
		setOpenFn,
	} = useEditorFloatingMenu();
	const runImportFn = (importAssetsFn: () => void) => {
		setOpenFn(false);
		importAssetsFn();
	};

	return (
		<>
			<div
				className="inline-flex h-12 min-h-0 shrink-0 overflow-hidden rounded-lg shadow-lg"
				data-ui="EditorAssetImportControl"
			>
				<PrimaryButton
					className="h-12 min-h-0 gap-2 rounded-r-none px-4 py-0 shadow-none"
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorAssetImport"
					disabled={pending}
					onClick={onImportArkpackFn}
				>
					<PackageOpen className="size-4" />
					Import assets
				</PrimaryButton>
				<PrimaryButton
					ref={refs.setReference}
					className="size-12 min-h-0 min-w-0 rounded-l-none border-l border-accent-contrast/25 p-0 shadow-none"
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorAssetImportMenuTrigger"
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
						data-ui="EditorAssetImportMenu"
						{...getFloatingPropsFn()}
					>
						<Button
							className="min-h-0 justify-start gap-3 border-0 bg-transparent px-2.5 py-2 text-left shadow-none"
							data-ui="EditorAssetImportArkpackOption"
							onClick={() => runImportFn(onImportArkpackFn)}
						>
							<PackageOpen className="size-5 shrink-0 text-accent" />
							<span>
								<span className="block font-semibold">From arkpack</span>
								<span className="mt-0.5 block text-xs font-normal leading-4 text-muted">
									Imports all assets and overrides matching resource IDs.
								</span>
							</span>
						</Button>
						<Button
							className="min-h-0 justify-start gap-3 border-0 bg-transparent px-2.5 py-2 text-left shadow-none"
							data-ui="EditorAssetImportFilesOption"
							onClick={() => runImportFn(onImportFilesFn)}
						>
							<Images className="size-5 shrink-0 text-accent" />
							<span>
								<span className="block font-semibold">PNG files</span>
								<span className="mt-0.5 block text-xs font-normal leading-4 text-muted">
									Imports selected PNG files using their filenames as resource
									IDs.
								</span>
							</span>
						</Button>
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};

const EditorAssetOptimizationAlert = ({
	message,
	onDismissFn,
	tone,
}: EditorAssetOptimizationAlertProps) => (
	<div
		className="mb-3 flex min-h-12 items-center gap-3 rounded-xl border-l-2 bg-surface-raised/60 px-4 py-3 text-sm data-[ui-tone=danger]:border-danger data-[ui-tone=danger]:bg-danger/10 data-[ui-tone=success]:border-success data-[ui-tone=success]:bg-success/10"
		{...readDataUiFn({
			dataUi: "EditorAssetsOptimizeAlert",
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
			data-ui="EditorAssetsOptimizeAlertDismiss"
			onClick={onDismissFn}
		>
			Dismiss
		</LinkButton>
	</div>
);

const EditorAssetCard = ({
	filter,
	query,
	resource,
}: {
	readonly filter: "all" | "unused";
	readonly query: string;
	readonly resource: Project.Resource;
}) => {
	const project = useEditorProject();
	const url = useResourceUrl(resource.id);
	return (
		<ButtonLink
			to="/editor/$projectId/assets/$resourceId/detail/overview"
			params={{
				projectId: project.projectId,
				resourceId: resource.id,
			}}
			search={{
				filter,
				query,
			}}
			className="group grid min-h-0 min-w-0 grid-rows-[minmax(8rem,1fr)_auto] overflow-hidden rounded-xl border-0 border-l-2 border-line-strong bg-surface-raised/60 p-0 text-left shadow-none hover:bg-surface-raised"
			data-ui="EditorAssetCard"
		>
			<span className="grid min-h-32 place-items-center overflow-hidden p-4">
				{url === undefined ? (
					<ImageIcon className="size-8 text-subtle" />
				) : (
					<img
						src={url}
						alt=""
						className="max-h-44 max-w-full object-contain"
						draggable={false}
						loading="lazy"
					/>
				)}
			</span>
			<span className="min-w-0 px-3 py-2.5">
				<span className="block truncate font-semibold">{resource.id}</span>
			</span>
		</ButtonLink>
	);
};

interface EditorAssetGridProps {
	readonly filter: "all" | "unused";
	readonly query: string;
	readonly resources: Project["resources"];
}

const readAssetKeyFn = (resource: Project["resources"][number]) => resource.id;

const EditorAssetGrid = memo(({ filter, query, resources }: EditorAssetGridProps) => {
	const renderAssetFn = useCallback(
		(resource: Project["resources"][number]) => (
			<EditorAssetCard
				filter={filter}
				query={query}
				resource={resource}
			/>
		),
		[
			filter,
			query,
		],
	);
	return (
		<EditorVirtualCollection
			items={resources}
			itemKeyFn={readAssetKeyFn}
			renderItemFn={renderAssetFn}
			estimatedRowHeight={244}
			gapRem={0.75}
			minColumnWidthRem={18}
		/>
	);
});

export const EditorAssetManager = (props: EditorAssetManagerProps) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const settledQuery = useDebouncedSearchQuery(props.query);
	const controller = useEditorAssetManagerController({
		filter: props.filter,
		query: settledQuery,
	});
	const catalogStatus =
		controller.catalogState === undefined
			? undefined
			: assetCatalogStatuses[controller.catalogState];
	const importError =
		controller.importError === undefined
			? undefined
			: controller.importError instanceof Error
				? controller.importError.message
				: String(controller.importError);
	const importSuccess =
		controller.importedCount === undefined
			? undefined
			: `Imported ${controller.importedCount} asset${controller.importedCount === 1 ? "" : "s"}.`;
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
				? `All ${controller.optimization.processedResourceCount} selected PNGs are already optimized.`
				: `Optimized ${controller.optimization.optimizedResourceCount} of ${controller.optimization.processedResourceCount} selected PNGs · ${formatByteSizeFn(Math.abs(controller.optimization.originalBytes - controller.optimization.optimizedBytes))} ${controller.optimization.optimizedBytes <= controller.optimization.originalBytes ? "saved" : "added by invisible color cleanup"}.`;
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
		<EditorAssetImportMenu
			onImportArkpackFn={controller.openArkpackImportFn}
			onImportFilesFn={controller.openFilesImportFn}
			pending={busy}
		/>
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
					<input
						ref={controller.arkpackInputRef}
						type="file"
						accept=".arkpack"
						className="hidden"
						data-ui="EditorAssetArkpackInput"
						disabled={busy}
						onChange={controller.onArkpackChangeFn}
					/>
					<input
						ref={controller.filesInputRef}
						type="file"
						accept="image/png,.png"
						multiple
						className="hidden"
						data-ui="EditorAssetImportInput"
						disabled={busy}
						onChange={controller.onFilesChangeFn}
					/>
					<SearchInput
						value={props.query}
						containerClassName="min-w-64 flex-1"
						className="h-12 min-h-12 w-full rounded-lg border border-line-strong bg-surface px-4 text-sm text-foreground outline-none placeholder:text-muted"
						data-ui="EditorAssetSearch"
						placeholder={`${translator.textFn("Search assets…")} (${controller.resources.length})`}
						onValueChangeFn={props.onQueryChangeFn}
					/>
					<SegmentedControl
						dataUi="EditorAssetFilters"
						onChangeFn={props.onFilterChangeFn}
						optionDataUi="EditorAssetFilter"
						options={assetFilters}
						size="large"
						value={props.filter}
					/>
					{controller.catalogState === "empty" ? null : (
						<Button
							className="relative isolate h-12 min-h-0 min-w-36 shrink-0 gap-2 overflow-hidden px-4 py-0"
							cursorIntent={busy ? "progress" : undefined}
							data-ui="EditorAssetsOptimize"
							disabled={busy || controller.resources.length === 0}
							onClick={controller.onOptimizeFn}
						>
							{controller.optimizePending ? (
								<span
									className="absolute inset-y-0 left-0 z-0 bg-accent/20 transition-[width] duration-200 ease-linear"
									data-ui="EditorAssetsOptimizeProgress"
									style={{
										width: `${optimizationPercent}%`,
									}}
								/>
							) : null}
							<span className="relative z-10 inline-flex items-center gap-2">
								<Sparkles className="size-4" />
								{controller.optimizePending
									? controller.optimizationProgress?.phase === "saving"
										? "Saving…"
										: `Optimizing ${optimizationPercent}%`
									: "Optimize"}
							</span>
						</Button>
					)}
					{controller.catalogState === "empty" ? null : importButton}
					<EditorPageHelp
						title={translator.textFn("Assets")}
						content={<Mx label="Asset catalog help" />}
					/>
				</header>
			}
			scrollRestorationId="editor-asset-list"
		>
			<div data-ui="EditorAssetManager">
				{importError === undefined ? null : (
					<p
						className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
						data-ui="EditorAssetImportError"
					>
						{importError}
					</p>
				)}
				{importSuccess === undefined ? null : (
					<p
						className="mb-3 text-sm text-success"
						data-ui="EditorAssetImportSuccess"
					>
						{importSuccess}
					</p>
				)}
				{optimizationAlert === undefined ? null : (
					<EditorAssetOptimizationAlert
						message={optimizationAlert.message}
						onDismissFn={controller.onOptimizationDismissFn}
						tone={optimizationAlert.tone}
					/>
				)}
				{catalogStatus === undefined ? null : (
					<Status
						dataUi={catalogStatus.dataUi}
						description={catalogStatus.description}
						icon={catalogStatus.icon}
						title={catalogStatus.title}
						action={controller.catalogState === "empty" ? importButton : undefined}
					/>
				)}
				<EditorAssetGrid
					filter={props.filter}
					query={settledQuery}
					resources={controller.resources}
				/>
			</div>
		</EditorSectionPage>
	);
};
