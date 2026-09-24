import { match } from "ts-pattern";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { type ChangeEventHandler, type RefObject, useRef } from "react";

import { importEditorArtworkFx } from "~/artwork-authoring/fx/importEditorArtworkFx";
import { EditorResourceOptimizationAtom } from "~/resource-authoring/atom/EditorResourceOptimizationAtom";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorArtworkLibrary } from "~/artwork-authoring/ui/useEditorArtworkLibrary";
import type { Project } from "~/project-authoring/type/Project";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";

export namespace useEditorArtworkManagerController {
	export type CatalogState = "empty" | "no-matches" | "unused-empty";
	export type Filter = ArtworkCatalogFilterSchema.Type;

	export interface Props {
		readonly filter: Filter;
		readonly query: string;
	}

	export interface Output {
		readonly serapackInputRef: RefObject<HTMLInputElement | null>;
		readonly catalogState?: CatalogState;
		readonly filesInputRef: RefObject<HTMLInputElement | null>;
		readonly importError?: unknown;
		readonly importPending: boolean;
		readonly notesLoading: boolean;
		readonly notesError?: unknown;
		readonly importedCount?: number;
		readonly onSerapackChangeFn: ChangeEventHandler<HTMLInputElement>;
		readonly onFilesChangeFn: ChangeEventHandler<HTMLInputElement>;
		readonly openSerapackImportFn: () => void;
		readonly openFilesImportFn: () => void;
		readonly onOptimizationDismissFn: () => void;
		readonly onOptimizeFn: () => void;
		readonly optimizeError?: unknown;
		readonly optimizePending: boolean;
		readonly optimization?: ProjectRepository.OptimizeResourcesResult;
		readonly optimizationProgress?: ProjectRepository.OptimizeResourcesProgress;
		readonly resources: ReadonlyArray<Project.Resource>;
	}
}

type ImportEditorArtworkProps =
	| {
			readonly file: File;
			readonly projectId: string;
			readonly source: "serapack";
	  }
	| {
			readonly files: ReadonlyArray<File>;
			readonly projectId: string;
			readonly source: "files";
	  };

const importEditorArtworkCommandAtom = RendererRuntime.runSync(
	Effect.map(ProjectWriteAdmission, (admission) =>
		Atom.fn((variables: ImportEditorArtworkProps) =>
			importEditorArtworkFx(variables).pipe(
				Effect.provideService(ProjectWriteAdmission, admission),
			),
		).pipe(Atom.withLabel("EditorArtworkImport"), Atom.setIdleTTL(0)),
	),
);

export const useEditorArtworkManagerController = ({
	filter,
	query,
}: useEditorArtworkManagerController.Props): useEditorArtworkManagerController.Output => {
	const library = useEditorArtworkLibrary({
		filter,
		query,
	});
	const serapackInputRef = useRef<HTMLInputElement>(null);
	const filesInputRef = useRef<HTMLInputElement>(null);
	const result = useAtomValue(importEditorArtworkCommandAtom);
	const importResourcesFn = useAtomSet(importEditorArtworkCommandAtom);
	const optimizationAtom = EditorResourceOptimizationAtom(library.projectId);
	const optimizationState = useAtomValue(optimizationAtom);
	const optimizeResourcesFn = useAtomSet(optimizationAtom);
	const importPending = result.waiting;
	const optimizePending = optimizationState.kind === "optimizing";
	const importError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const importedCount =
		AsyncResult.isSuccess(result) && !importPending
			? result.value.resourceUids.length
			: undefined;
	const optimizeError =
		optimizationState.kind === "failure" && optimizationState.type === "artwork"
			? optimizationState.error
			: undefined;
	const optimization =
		optimizationState.kind === "success" && optimizationState.type === "artwork"
			? optimizationState.result
			: undefined;
	const optimizationProgress =
		optimizationState.kind === "optimizing" && optimizationState.type === "artwork"
			? optimizationState.progress
			: undefined;
	const catalogState = match({
		library,
		filter,
		query: query.trim(),
	})
		.returnType<useEditorArtworkManagerController.CatalogState | undefined>()
		.with(
			{
				library: {
					empty: true,
				},
			},
			() => "empty",
		)
		.when(
			({ library }) =>
				library.notesLoading ||
				library.notesError !== undefined ||
				library.resources.length > 0,
			() => undefined,
		)
		.with(
			{
				filter: "unused",
				query: "",
			},
			() => "unused-empty",
		)
		.otherwise(() => "no-matches");
	const openSerapackImportFn = () => {
		serapackInputRef.current?.click();
	};
	const openFilesImportFn = () => {
		filesInputRef.current?.click();
	};
	const onSerapackChangeFn: ChangeEventHandler<HTMLInputElement> = (event) => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = "";
		if (file === undefined) return;
		importResourcesFn({
			file,
			projectId: library.projectId,
			source: "serapack",
		});
	};
	const onFilesChangeFn: ChangeEventHandler<HTMLInputElement> = (event) => {
		const files = Array.from(event.currentTarget.files ?? []);
		event.currentTarget.value = "";
		if (files.length === 0) return;
		importResourcesFn({
			files,
			projectId: library.projectId,
			source: "files",
		});
	};
	const onOptimizeFn = () => {
		if (library.resources.length === 0) return;
		optimizeResourcesFn({
			expectedRevision: library.projectRevision,
			kind: "optimize",
			resourceUids: library.resources.map(({ uid }) => uid),
			type: "artwork",
		});
	};
	const onOptimizationDismissFn = () => {
		optimizeResourcesFn({
			kind: "dismiss",
		});
	};

	return {
		serapackInputRef,
		catalogState,
		filesInputRef,
		importError,
		importPending,
		notesLoading: library.notesLoading,
		notesError: library.notesError,
		importedCount,
		onSerapackChangeFn,
		onFilesChangeFn,
		onOptimizationDismissFn,
		onOptimizeFn,
		openSerapackImportFn,
		openFilesImportFn,
		optimization,
		optimizationProgress,
		optimizeError,
		optimizePending,
		resources: library.resources,
	};
};
