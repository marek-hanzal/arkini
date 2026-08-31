import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { match, P } from "ts-pattern";

import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import { readArkpackArtifactNameFn } from "~/arkpack/artifact/fn/readArkpackArtifactNameFn";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import { EditorProjectRepositoryError } from "~/project-authoring/error/EditorProjectRepositoryError";
import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";
import { GameValidationError } from "~/game-config/diagnostic/error/GameValidationError";
import type { GameDiagnosticSchema } from "~/game-config/diagnostic/schema/GameDiagnosticSchema";
import { EditorBuildCommandAtoms } from "./EditorBuildCommandAtoms";

export type EditorBuildFailure =
	| {
			readonly type: "validation";
			readonly diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>;
	  }
	| {
			readonly type: "operational";
			readonly detail: string;
	  };

type EditorBuildStatus = "building" | "not-built" | "stale" | "valid";

const emptyDiagnostics: ReadonlyArray<GameDiagnosticSchema.Type> = [];

const buildStatusLabels = {
	building: "Building",
	"not-built": "Not built",
	stale: "Stale",
	valid: "Valid",
} as const;

const readEditorBuildFailureFn = (error: unknown): EditorBuildFailure | undefined => {
	if (error === undefined) return undefined;
	if (error instanceof GameValidationError)
		return {
			type: "validation",
			diagnostics: error.diagnostics,
		};
	if (error instanceof EditorProjectRepositoryError) {
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
		detail: "The Editor project could not be built because of an unknown error.",
	};
};

export namespace useEditorBuildArtifactController {
	export interface Props {
		readonly project: EditorProject;
	}

	export interface Output {
		readonly artifact?: EditorProjectBuildSchema.Type;
		readonly artifactSummary?: string;
		readonly build: () => void;
		readonly buildFailure?: EditorBuildFailure;
		readonly buildPending: boolean;
		readonly buildStatus: EditorBuildStatus;
		readonly buildStatusLabel: string;
		readonly buildSummary: string;
		readonly diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>;
	}
}

/** Owns one project's build command and admission of its exact current-revision artifact. */
export const useEditorBuildArtifactController = ({
	project,
}: useEditorBuildArtifactController.Props): useEditorBuildArtifactController.Output => {
	const buildAtom = EditorBuildCommandAtoms.build(project.projectId);
	const buildResult = useAtomValue(buildAtom);
	const runBuild = useAtomSet(buildAtom);
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
	const buildSummary = match({
		artifact,
		stale: artifactStale,
	})
		.with(
			{
				artifact: P.nonNullable,
			},
			({ artifact: currentArtifact }) =>
				`Revision ${currentArtifact.revision} built with ${currentArtifact.diagnostics.length} non-blocking diagnostic${currentArtifact.diagnostics.length === 1 ? "" : "s"}.`,
		)
		.with(
			{
				stale: true,
			},
			() => "The project changed after the last build. Build the current revision again.",
		)
		.otherwise(() => "Run a build to execute the complete game and resource validation.");
	const artifactSummary = match(artifact)
		.with(
			P.nonNullable,
			(currentArtifact) =>
				`${readArkpackArtifactNameFn(currentArtifact.projectId)} · ${formatByteSizeFn(currentArtifact.size)} · v${project.version} · Arkini ${ArkiniAppVersion} · Community · ${currentArtifact.contentHash}`,
		)
		.otherwise(() => undefined);

	return {
		artifact,
		artifactSummary,
		build: () => {
			runBuild({
				expectedRevision: project.revision,
			});
		},
		buildFailure,
		buildPending: buildResult.waiting,
		buildStatus,
		buildStatusLabel: buildStatusLabels[buildStatus],
		buildSummary,
		diagnostics,
	};
};
