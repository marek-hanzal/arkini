import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { BadgeCheck, Images, SearchX, type LucideIcon } from "lucide-react";
import { type ChangeEventHandler, type RefObject, useCallback, useMemo, useRef } from "react";
import { match, P } from "ts-pattern";

import { importEditorAssetsCommandAtom } from "~/bridge/resource/editor/importEditorAssetsCommandAtom";
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
	description: "Import assets from an arkpack or select PNG files to start the library.",
	icon: Images,
	title: "No assets yet",
} as const;

const unusedStatus = {
	dataUi: "EditorAssetsFilteredEmpty",
	description: "Every asset is referenced by the current project.",
	icon: BadgeCheck,
	title: "No unused assets",
} as const;

const noMatchesStatus = {
	dataUi: "EditorAssetsFilteredEmpty",
	description: "No assets match the current search and usage filter.",
	icon: SearchX,
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
		readonly icon: LucideIcon;
		readonly title: string;
	}

	export interface Output {
		readonly arkpackInputRef: RefObject<HTMLInputElement | null>;
		readonly catalogStatus?: CatalogStatus;
		readonly changeFilter: (props: ChangeFilterProps) => void;
		readonly filter: Filter;
		readonly filters: ReadonlyArray<FilterOption>;
		readonly importError?: string;
		readonly filesInputRef: RefObject<HTMLInputElement | null>;
		readonly importPending: boolean;
		readonly importSuccess?: string;
		readonly onArkpackChange: ChangeEventHandler<HTMLInputElement>;
		readonly onFilesChange: ChangeEventHandler<HTMLInputElement>;
		readonly onQueryChange: ChangeEventHandler<HTMLInputElement>;
		readonly openArkpackImport: () => void;
		readonly openFilesImport: () => void;
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
	const arkpackInputRef = useRef<HTMLInputElement>(null);
	const filesInputRef = useRef<HTMLInputElement>(null);
	const result = useAtomValue(importEditorAssetsCommandAtom);
	const importAssets = useAtomSet(importEditorAssetsCommandAtom);
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
	const openArkpackImport = useCallback(() => {
		arkpackInputRef.current?.click();
	}, []);
	const openFilesImport = useCallback(() => {
		filesInputRef.current?.click();
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
	const onArkpackChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
		(event) => {
			const file = event.currentTarget.files?.[0];
			event.currentTarget.value = "";
			if (file === undefined) return;
			importAssets({
				file,
				projectId: library.projectId,
				source: "arkpack",
			});
		},
		[
			importAssets,
			library.projectId,
		],
	);
	const onFilesChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
		(event) => {
			const files = Array.from(event.currentTarget.files ?? []);
			event.currentTarget.value = "";
			if (files.length === 0) return;
			importAssets({
				files,
				projectId: library.projectId,
				source: "files",
			});
		},
		[
			library.projectId,
			importAssets,
		],
	);

	return useMemo(
		() => ({
			arkpackInputRef,
			catalogStatus,
			changeFilter,
			filter,
			filters: filterOptions,
			filesInputRef,
			importError,
			importPending,
			importSuccess,
			onArkpackChange,
			onFilesChange,
			onQueryChange: handleQueryChange,
			openArkpackImport,
			openFilesImport,
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
			onArkpackChange,
			onFilesChange,
			openArkpackImport,
			openFilesImport,
			query,
		],
	);
};
