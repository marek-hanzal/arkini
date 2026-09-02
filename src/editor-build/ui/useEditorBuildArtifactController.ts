import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { match, P } from "ts-pattern";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { Project } from "~/project-authoring/type/Project";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { GameValidationError } from "~/game-config-diagnostic/error/GameValidationError";
import type { GameDiagnosticSchema } from "~/game-config-diagnostic/schema/GameDiagnosticSchema";
import { BuildCommandAtoms } from "~/editor-build/atom/BuildCommandAtoms";

export type EditorBuildFailure =
	| {
			readonly type: "validation";
			readonly diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>;
	  }
	| {
			readonly type: "operational";
			readonly detail?: string;
	  };

type EditorBuildStatus = "building" | "not-built" | "stale" | "valid";

const emptyDiagnostics: ReadonlyArray<GameDiagnosticSchema.Type> = [];

const readEditorBuildFailureFn = (error: unknown): EditorBuildFailure | undefined => {
	if (error === undefined) return undefined;
	if (error instanceof GameValidationError)
		return {
			type: "validation",
			diagnostics: error.diagnostics,
		};
	if (error instanceof ProjectRepositoryError) {
		if (error.diagnostics !== undefined)
			return {
				type: "validation",
				diagnostics: error.diagnostics,
			};
		return {
			type: "operational",
			detail: error.message,
		};
	}
	return {
		type: "operational",
	};
};

export namespace useEditorBuildArtifactController {
	export interface Props {
		readonly canBuild: boolean;
		readonly project: Project;
	}

	export interface Output {
		readonly artifact?: EditorProjectBuildSchema.Type;
		readonly buildFn: () => void;
		readonly buildFailure?: EditorBuildFailure;
		readonly buildPending: boolean;
		readonly buildStatus: EditorBuildStatus;
		readonly diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>;
	}
}

/** Owns one project's build command and admission of its exact current-revision artifact. */
export const useEditorBuildArtifactController = ({
	canBuild,
	project,
}: useEditorBuildArtifactController.Props): useEditorBuildArtifactController.Output => {
	const buildAtom = BuildCommandAtoms.build(project.projectId);
	const buildResult = useAtomValue(buildAtom);
	const runBuildFn = useAtomSet(buildAtom);
	const builtArtifact =
		AsyncResult.isSuccess(buildResult) && !buildResult.waiting ? buildResult.value : undefined;
	const artifact = builtArtifact?.revision === project.revision ? builtArtifact : undefined;
	const artifactStale = builtArtifact !== undefined && artifact === undefined;
	const buildError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(buildResult));
	const buildFailure = readEditorBuildFailureFn(buildError);
	const diagnostics =
		buildFailure?.type === "validation"
			? buildFailure.diagnostics
			: (artifact?.diagnostics ?? emptyDiagnostics);
	const buildStatus = match({
		artifact,
		stale: artifactStale,
		waiting: buildResult.waiting,
	})
		.with(
			{
				waiting: true,
			},
			() => "building" as const,
		)
		.with(
			{
				artifact: P.nonNullable,
			},
			() => "valid" as const,
		)
		.with(
			{
				stale: true,
			},
			() => "stale" as const,
		)
		.otherwise(() => "not-built" as const);
	return {
		artifact,
		buildFn: () => {
			if (!canBuild) return;
			runBuildFn({
				expectedRevision: project.revision,
			});
		},
		buildFailure,
		buildPending: buildResult.waiting,
		buildStatus,
		diagnostics,
	};
};
