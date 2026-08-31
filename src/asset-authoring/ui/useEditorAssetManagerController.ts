import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { BadgeCheck, Images, SearchX, type LucideIcon } from "lucide-react";
import { type ChangeEventHandler, type RefObject, useCallback, useRef } from "react";
import { match, P } from "ts-pattern";

import { importEditorAssetsFx } from "~/asset-authoring/session/importEditorAssetsFx";
import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";
import { useEditorAssetLibrary } from "~/asset-authoring/ui/useEditorAssetLibrary";

export namespace useEditorAssetManagerController {
	export type Filter = "all" | "unused";

	export interface Props {
		readonly filter: Filter;
		readonly query: string;
	}

	export interface Output {
		readonly arkpackInputRef: RefObject<HTMLInputElement | null>;
		readonly catalogStatus?: {
			readonly action?: "import";
			readonly dataUi: string;
			readonly description: string;
			readonly icon: LucideIcon;
			readonly title: string;
		};
		readonly filters: ReadonlyArray<{
			readonly label: string;
			readonly selected: boolean;
			readonly value: Filter;
		}>;
		readonly importError?: string;
		readonly filesInputRef: RefObject<HTMLInputElement | null>;
		readonly importPending: boolean;
		readonly importSuccess?: string;
		readonly onArkpackChange: ChangeEventHandler<HTMLInputElement>;
		readonly onFilesChange: ChangeEventHandler<HTMLInputElement>;
		readonly openArkpackImport: () => void;
		readonly openFilesImport: () => void;
		readonly resources: ReturnType<typeof useEditorAssetLibrary>["resources"];
		readonly showHeaderImport: boolean;
	}
}

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

type ImportEditorAssetsProps =
	| {
			readonly file: File;
			readonly projectId: string;
			readonly source: "arkpack";
	  }
	| {
			readonly files: ReadonlyArray<File>;
			readonly projectId: string;
			readonly source: "files";
	  };

const importEditorAssetsCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn((variables: ImportEditorAssetsProps) =>
			importEditorAssetsFx(variables).pipe(
				Effect.provideService(EditorProjectRepository, repository),
			),
		).pipe(Atom.withLabel("EditorAssetsImport"), Atom.setIdleTTL(0)),
	),
);

export const useEditorAssetManagerController = ({
	filter,
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
	const importError =
		error === undefined
			? undefined
			: match(error)
					.with(P.instanceOf(Error), (current) => current.message)
					.otherwise(String);
	const importedCount =
		AsyncResult.isSuccess(result) && !importPending
			? result.value.resourceIds.length
			: undefined;
	const importSuccess =
		importedCount === undefined
			? undefined
			: `Imported ${importedCount} asset${importedCount === 1 ? "" : "s"}.`;
	const filterOptions = filters.map((option) => ({
		...option,
		selected: option.value === filter,
	}));
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

	return {
		arkpackInputRef,
		catalogStatus,
		filters: filterOptions,
		filesInputRef,
		importError,
		importPending,
		importSuccess,
		onArkpackChange,
		onFilesChange,
		openArkpackImport,
		openFilesImport,
		resources: library.resources,
		showHeaderImport: !library.empty,
	};
};
