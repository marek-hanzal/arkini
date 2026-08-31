import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { type ChangeEventHandler, type RefObject, useRef } from "react";

import { importEditorAssetsFx } from "~/asset-authoring/fx/importEditorAssetsFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorAssetLibrary } from "~/asset-authoring/ui/useEditorAssetLibrary";
import type { Project } from "~/project-authoring/type/Project";

export namespace useEditorAssetManagerController {
	export type CatalogState = "empty" | "no-matches" | "unused-empty";
	export type Filter = "all" | "unused";

	export interface Props {
		readonly filter: Filter;
		readonly query: string;
	}

	export interface Output {
		readonly arkpackInputRef: RefObject<HTMLInputElement | null>;
		readonly catalogState?: CatalogState;
		readonly filesInputRef: RefObject<HTMLInputElement | null>;
		readonly importError?: unknown;
		readonly importPending: boolean;
		readonly importedCount?: number;
		readonly onArkpackChangeFn: ChangeEventHandler<HTMLInputElement>;
		readonly onFilesChangeFn: ChangeEventHandler<HTMLInputElement>;
		readonly openArkpackImportFn: () => void;
		readonly openFilesImportFn: () => void;
		readonly resources: ReadonlyArray<Project.Resource>;
	}
}

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
	Effect.map(ProjectRepository, (repository) =>
		Atom.fn((variables: ImportEditorAssetsProps) =>
			importEditorAssetsFx(variables).pipe(
				Effect.provideService(ProjectRepository, repository),
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
	const importAssetsFn = useAtomSet(importEditorAssetsCommandAtom);
	const importPending = result.waiting;
	const importError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const importedCount =
		AsyncResult.isSuccess(result) && !importPending
			? result.value.resourceIds.length
			: undefined;
	const catalogState: useEditorAssetManagerController.CatalogState | undefined = library.empty
		? "empty"
		: library.resources.length > 0
			? undefined
			: filter === "unused" && query.trim() === ""
				? "unused-empty"
				: "no-matches";
	const openArkpackImportFn = () => {
		arkpackInputRef.current?.click();
	};
	const openFilesImportFn = () => {
		filesInputRef.current?.click();
	};
	const onArkpackChangeFn: ChangeEventHandler<HTMLInputElement> = (event) => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = "";
		if (file === undefined) return;
		importAssetsFn({
			file,
			projectId: library.projectId,
			source: "arkpack",
		});
	};
	const onFilesChangeFn: ChangeEventHandler<HTMLInputElement> = (event) => {
		const files = Array.from(event.currentTarget.files ?? []);
		event.currentTarget.value = "";
		if (files.length === 0) return;
		importAssetsFn({
			files,
			projectId: library.projectId,
			source: "files",
		});
	};

	return {
		arkpackInputRef,
		catalogState,
		filesInputRef,
		importError,
		importPending,
		importedCount,
		onArkpackChangeFn,
		onFilesChangeFn,
		openArkpackImportFn,
		openFilesImportFn,
		resources: library.resources,
	};
};
