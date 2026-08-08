import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useRef } from "react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { saveEditorAssetsCommandAtom } from "~/bridge/resource/editor/saveEditorAssetsCommandAtom";
import { PrimaryButton } from "~/ui/button/Button";
import {
	selectableActiveClassName,
	selectableInactiveClassName,
} from "~/ui/form/SelectableStateClassName";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";
import { EditorAssetCard } from "~/ui/resource/editor/EditorAssetCard";
import { useEditorAssetLibrary } from "~/ui/resource/editor/useEditorAssetLibrary";
import { Status } from "~/ui/status/Status";

export namespace EditorAssetManager {
	export interface Props {
		readonly filter: "all" | "unused";
		readonly onFilterChange: (filter: "all" | "unused") => void;
		readonly onQueryChange: (query: string) => void;
		readonly query: string;
	}
}

/** Presents the canonical project resource catalog and owns its batch-import command. */
export const EditorAssetManager = ({
	filter,
	onFilterChange,
	onQueryChange,
	query,
}: EditorAssetManager.Props) => {
	const { empty, project, resources } = useEditorAssetLibrary({
		filter,
		query,
	});
	const inputRef = useRef<HTMLInputElement>(null);
	const result = useAtomValue(saveEditorAssetsCommandAtom);
	const saveAssets = useAtomSet(saveEditorAssetsCommandAtom);
	const error = readSettledAsyncResultError(result);
	const pending = result.waiting;
	const importButton = (
		<PrimaryButton
			disabled={pending}
			cursorIntent={pending ? "progress" : undefined}
			className="h-12 min-h-0 shrink-0 gap-2"
			onClick={() => inputRef.current?.click()}
		>
			<span
				className="icon-[lucide--upload] size-4"
				aria-hidden="true"
			/>
			{pending ? "Importing…" : "Import assets"}
		</PrimaryButton>
	);
	return (
		<section
			className="h-full min-h-0 overflow-y-auto overscroll-contain"
			aria-label="Assets"
			data-ui="EditorAssetManager"
		>
			<header className="ak-editor-page-header flex min-w-0 flex-wrap items-center gap-2 p-3">
				<input
					ref={inputRef}
					type="file"
					accept="image/png,.png"
					multiple
					className="sr-only"
					disabled={pending}
					onChange={(event) => {
						const files = Array.from(event.currentTarget.files ?? []);
						event.currentTarget.value = "";
						if (files.length === 0) return;
						saveAssets({
							files,
							projectId: project.projectId,
						});
					}}
				/>
				<input
					type="search"
					value={query}
					className="h-12 min-w-64 flex-1 rounded-lg border border-line-strong bg-surface px-4 text-sm text-foreground outline-none placeholder:text-muted"
					placeholder="Search assets…"
					aria-label="Search assets"
					onChange={(event) => onQueryChange(event.currentTarget.value)}
				/>
				<div
					className="inline-flex h-12 rounded-lg border border-line bg-surface p-1"
					aria-label="Asset usage filter"
					role="group"
				>
					{(
						[
							"all",
							"unused",
						] as const
					).map((value) => (
						<button
							key={value}
							type="button"
							className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold ${filter === value ? selectableActiveClassName : selectableInactiveClassName}`}
							aria-pressed={filter === value}
							onClick={() => onFilterChange(value)}
						>
							{value === "all" ? "All" : "Unused assets"}
						</button>
					))}
				</div>
				{empty ? null : importButton}
			</header>
			<div className="px-3 pt-3 pb-3">
				{error === undefined ? null : (
					<p className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						{error instanceof Error ? error.message : String(error)}
					</p>
				)}
				{AsyncResult.isSuccess(result) && !pending ? (
					<p
						className="mb-3 text-sm text-success"
						role="status"
					>
						Imported {result.value.resourceIds.length} asset
						{result.value.resourceIds.length === 1 ? "" : "s"}.
					</p>
				) : null}
				{empty ? (
					<Status
						dataUi="EditorAssetsEmpty"
						description="Import PNG files to start building this project's asset library."
						icon="icon-[lucide--images]"
						title="No assets yet"
						action={importButton}
					/>
				) : null}
				{!empty && resources.length === 0 ? (
					<Status
						dataUi="EditorAssetsFilteredEmpty"
						description={
							filter === "unused" && query.trim() === ""
								? "Every asset is referenced by the current project."
								: "No assets match the current search and usage filter."
						}
						icon={
							filter === "unused"
								? "icon-[lucide--badge-check]"
								: "icon-[lucide--search-x]"
						}
						title={
							filter === "unused" && query.trim() === ""
								? "No unused assets"
								: "No matching assets"
						}
					/>
				) : null}
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
			</div>
		</section>
	);
};
