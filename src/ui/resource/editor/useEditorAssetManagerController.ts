import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { type ChangeEventHandler, type RefObject, useCallback, useMemo, useRef } from "react";
import { match, P } from "ts-pattern";

import { saveEditorAssetsCommandAtom } from "~/bridge/resource/editor/saveEditorAssetsCommandAtom";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";
import { useEditorAssetLibrary } from "~/ui/resource/editor/useEditorAssetLibrary";

const filters = [
	{
		label: "All",
		value: "all",
	},
	{
		label: "Unused assets",
		value: "unused",
	},
] as const;

const emptyStatus = {
	action: "import",
	dataUi: "EditorAssetsEmpty",
	description: "Import PNG files to start building this project's asset library.",
	icon: "icon-[lucide--images]",
	title: "No assets yet",
} as const;

const unusedStatus = {
	dataUi: "EditorAssetsFilteredEmpty",
	description: "Every asset is referenced by the current project.",
	icon: "icon-[lucide--badge-check]",
	title: "No unused assets",
} as const;

const noMatchesStatus = {
	dataUi: "EditorAssetsFilteredEmpty",
	description: "No assets match the current search and usage filter.",
	icon: "icon-[lucide--search-x]",
	title: "No matching assets",
} as const;

const errorMessage = (error: unknown) =>
	match(error)
		.with(P.instanceOf(Error), (current) => current.message)
		.otherwise(String);

export namespace useEditorAssetManagerController {
	export type Filter = "all" | "unused";

	export interface Props {
		readonly filter: Filter;
		readonly onFilterChange: (filter: Filter) => void;
		readonly onQueryChange: (query: string) => void;
		readonly query: string;
	}

	export interface ChangeFilterProps {
		readonly filter: Filter;
	}

	export interface FilterOption {
		readonly label: string;
		readonly selected: boolean;
		readonly value: Filter;
	}

	export interface CatalogStatus {
		readonly action?: "import";
		readonly dataUi: string;
		readonly description: string;
		readonly icon: string;
		readonly title: string;
	}

	export interface Output {
		readonly catalogStatus?: CatalogStatus;
		readonly changeFilter: (props: ChangeFilterProps) => void;
		readonly filter: Filter;
		readonly filters: ReadonlyArray<FilterOption>;
		readonly importButtonLabel: string;
		readonly importError?: string;
		readonly importInputRef: RefObject<HTMLInputElement | null>;
		readonly importPending: boolean;
		readonly importSuccess?: string;
		readonly onFilesChange: ChangeEventHandler<HTMLInputElement>;
		readonly onQueryChange: ChangeEventHandler<HTMLInputElement>;
		readonly openImport: () => void;
		readonly query: string;
		readonly resources: useEditorAssetLibrary.Output["resources"];
		readonly showHeaderImport: boolean;
	}
}

export const useEditorAssetManagerController = ({
	filter,
	onFilterChange,
	onQueryChange,
	query,
}: useEditorAssetManagerController.Props): useEditorAssetManagerController.Output => {
	const library = useEditorAssetLibrary({
		filter,
		query,
	});
	const importInputRef = useRef<HTMLInputElement>(null);
	const result = useAtomValue(saveEditorAssetsCommandAtom);
	const saveAssets = useAtomSet(saveEditorAssetsCommandAtom);
	const importPending = result.waiting;
	const error = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const importError = error === undefined ? undefined : errorMessage(error);
	const importedCount =
		AsyncResult.isSuccess(result) && !importPending
			? result.value.resourceIds.length
			: undefined;
	const importSuccess =
		importedCount === undefined
			? undefined
			: `Imported ${importedCount} asset${importedCount === 1 ? "" : "s"}.`;
	const filterOptions = useMemo(
		() =>
			filters.map((option) => ({
				...option,
				selected: option.value === filter,
			})),
		[
			filter,
		],
	);
	const catalogStatus = match({
		empty: library.empty,
		filteredEmpty: library.resources.length === 0,
		filter,
		query: query.trim(),
	})
		.with(
			{
				empty: true,
			},
			() => emptyStatus,
		)
		.with(
			{
				empty: false,
				filteredEmpty: true,
				filter: "unused",
				query: "",
			},
			() => unusedStatus,
		)
		.with(
			{
				empty: false,
				filteredEmpty: true,
			},
			() => noMatchesStatus,
		)
		.otherwise(() => undefined);
	const openImport = useCallback(() => {
		importInputRef.current?.click();
	}, []);
	const changeFilter = useCallback(
		({ filter: nextFilter }: useEditorAssetManagerController.ChangeFilterProps) => {
			onFilterChange(nextFilter);
		},
		[
			onFilterChange,
		],
	);
	const handleQueryChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
		(event) => {
			onQueryChange(event.currentTarget.value);
		},
		[
			onQueryChange,
		],
	);
	const onFilesChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
		(event) => {
			const files = Array.from(event.currentTarget.files ?? []);
			event.currentTarget.value = "";
			if (files.length === 0) return;
			saveAssets({
				files,
				projectId: library.projectId,
			});
		},
		[
			library.projectId,
			saveAssets,
		],
	);

	return useMemo(
		() => ({
			catalogStatus,
			changeFilter,
			filter,
			filters: filterOptions,
			importButtonLabel: importPending ? "Importing…" : "Import assets",
			importError,
			importInputRef,
			importPending,
			importSuccess,
			onFilesChange,
			onQueryChange: handleQueryChange,
			openImport,
			query,
			resources: library.resources,
			showHeaderImport: !library.empty,
		}),
		[
			catalogStatus,
			changeFilter,
			filter,
			filterOptions,
			handleQueryChange,
			importError,
			importPending,
			importSuccess,
			library.empty,
			library.resources,
			onFilesChange,
			openImport,
			query,
		],
	);
};
