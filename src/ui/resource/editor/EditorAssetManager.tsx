import { memo } from "react";

import { PrimaryButton } from "~/ui/button/Button";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";
import { EditorAssetCard } from "~/ui/resource/editor/EditorAssetCard";
import { useEditorAssetManagerController } from "~/ui/resource/editor/useEditorAssetManagerController";
import type { useEditorAssetLibrary } from "~/ui/resource/editor/useEditorAssetLibrary";
import { Status } from "~/ui/status/Status";

export namespace EditorAssetManager {
	export interface Props extends useEditorAssetManagerController.Props {}
}

interface EditorAssetImportButtonProps {
	readonly label: string;
	readonly onClick: () => void;
	readonly pending: boolean;
}

const EditorAssetImportButton = ({ label, onClick, pending }: EditorAssetImportButtonProps) => (
	<PrimaryButton
		className="h-12 min-h-0 shrink-0 gap-2"
		cursorIntent={pending ? "progress" : undefined}
		data-ui="EditorAssetImport"
		disabled={pending}
		onClick={onClick}
	>
		<span className="icon-[lucide--upload] size-4" />
		{label}
	</PrimaryButton>
);

interface EditorAssetGridProps {
	readonly filter: useEditorAssetManagerController.Filter;
	readonly query: string;
	readonly resources: useEditorAssetLibrary.Output["resources"];
}

const EditorAssetGrid = memo(({ filter, query, resources }: EditorAssetGridProps) => (
	<div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3">
		{resources.map((resource) => (
			<EditorAssetCard
				key={resource.id}
				filter={filter}
				query={query}
				resource={resource}
			/>
		))}
	</div>
));

export const EditorAssetManager = (props: EditorAssetManager.Props) => {
	const controller = useEditorAssetManagerController(props);
	const importButton = (
		<EditorAssetImportButton
			label={controller.importButtonLabel}
			onClick={controller.openImport}
			pending={controller.importPending}
		/>
	);

	return (
		<section
			className="h-full min-h-0 overflow-y-auto overscroll-contain"
			data-ui="EditorAssetManager"
		>
			<header className="ak-editor-page-header flex min-w-0 flex-wrap items-center gap-2 p-3">
				<input
					ref={controller.importInputRef}
					type="file"
					accept="image/png,.png"
					multiple
					className="sr-only"
					data-ui="EditorAssetImportInput"
					disabled={controller.importPending}
					onChange={controller.onFilesChange}
				/>
				<input
					type="search"
					value={controller.query}
					className="h-12 min-w-64 flex-1 rounded-lg border border-line-strong bg-surface px-4 text-sm text-foreground outline-none placeholder:text-muted"
					data-ui="EditorAssetSearch"
					placeholder="Search assets…"
					onChange={controller.onQueryChange}
				/>
				<div
					className="inline-flex h-12 rounded-lg border border-line bg-surface p-1"
					data-ui="EditorAssetFilters"
				>
					{controller.filters.map((option) => (
						<button
							key={option.value}
							type="button"
							className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold ${option.selected ? selectableActiveClassName : selectableInactiveClassName}`}
							data-filter={option.value}
							data-selected={option.selected ? "true" : undefined}
							onClick={() =>
								controller.changeFilter({
									filter: option.value,
								})
							}
						>
							{option.label}
						</button>
					))}
				</div>
				{controller.showHeaderImport ? importButton : null}
			</header>
			<div className="px-3 pt-3 pb-3">
				{controller.importError === undefined ? null : (
					<p
						className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
						data-ui="EditorAssetImportError"
					>
						{controller.importError}
					</p>
				)}
				{controller.importSuccess === undefined ? null : (
					<p
						className="mb-3 text-sm text-success"
						data-ui="EditorAssetImportSuccess"
					>
						{controller.importSuccess}
					</p>
				)}
				{controller.catalogStatus === undefined ? null : (
					<Status
						dataUi={controller.catalogStatus.dataUi}
						description={controller.catalogStatus.description}
						icon={controller.catalogStatus.icon}
						title={controller.catalogStatus.title}
						action={
							controller.catalogStatus.action === "import" ? importButton : undefined
						}
					/>
				)}
				<EditorAssetGrid
					filter={controller.filter}
					query={controller.query}
					resources={controller.resources}
				/>
			</div>
		</section>
	);
};
