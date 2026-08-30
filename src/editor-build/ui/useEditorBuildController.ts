import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo, useState } from "react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { match, P } from "ts-pattern";

import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import {
	type EditorBuildMajorUpdateConfirmation,
	readEditorBuildInstallPlanFn,
} from "~/editor-build/domain/fn/readEditorBuildInstallPlanFn";
import { ArkpackCatalogAtom } from "~/arkpack/ui/ArkpackCatalogAtom";
import { readArkpackArtifactNameFn } from "~/arkpack/artifact/fn/readArkpackArtifactNameFn";
import type { EditorProject } from "~/project-authoring/EditorProject";
import { EditorProjectRepositoryError } from "~/project-authoring/repository/EditorProjectRepositoryError";
import {
	EditorBuildRepository,
	type EditorBuildRepository as EditorBuildRepositoryContract,
} from "~/editor-build/domain/EditorBuildRepository";
import type { EditorProjectBuildSchema } from "~/editor-build/domain/EditorProjectBuildSchema";
import { ArkpackCatalogOwnerAtom } from "~/arkpack/renderer/ArkpackCatalogOwnerAtom";
import { useEditorProject } from "~/authoring-session/useEditorProject";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { formatByteSizeFn } from "~/ui/formatByteSizeFn";
import { installBuiltEditorArkpackFx } from "~/editor-build/renderer/installBuiltEditorArkpackFx";
import { saveEditorBuildFx } from "~/editor-build/renderer/saveEditorBuildFx";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";
import { GameValidationError } from "~/game-config/diagnostic/error/GameValidationError";
import type { GameDiagnosticSchema } from "~/game-config/diagnostic/schema/GameDiagnosticSchema";

type EditorGameDiagnostic = GameDiagnosticSchema.Type;

type EditorBuildFailure =
	| {
			readonly type: "validation";
			readonly diagnostics: ReadonlyArray<EditorGameDiagnostic>;
	  }
	| {
			readonly type: "operational";
			readonly detail: string;
	  };

const emptyDiagnostics: ReadonlyArray<EditorGameDiagnostic> = [];

const readErrorMessageFn = (error: unknown) =>
	error === undefined ? undefined : error instanceof Error ? error.message : String(error);

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

const buildStatusLabels = {
	building: "Building",
	"not-built": "Not built",
	stale: "Stale",
	valid: "Valid",
} as const;

const EditorBuildCommandAtoms = RendererRuntime.runSync(
	Effect.map(EditorBuildRepository, (repository) => ({
		build: Atom.family((projectId: string) =>
			Atom.fn((request: Omit<EditorBuildRepositoryContract.BuildProps, "projectId">) =>
				repository.buildProjectFx({
					...request,
					projectId,
				}),
			).pipe(Atom.setIdleTTL(0)),
		),
		install: Atom.family((contentHash: string) =>
			Atom.fn(
				(
					request: {
						readonly artifact: EditorProjectBuildSchema.Type;
						readonly confirmation?: EditorBuildMajorUpdateConfirmation;
						readonly targetVersion: ArkpackVersionSchema.Type;
					},
					get,
				) => {
					const { artifact } = request;
					if (artifact.contentHash !== contentHash)
						return Effect.fail(
							new Error("The selected editor build artifact is stale."),
						);
					const catalog = get(ArkpackCatalogOwnerAtom);
					if (catalog === undefined)
						return Effect.fail(new Error("Arkpack catalog is not configured."));
					return installBuiltEditorArkpackFx({
						...request,
						catalog,
						repository,
					});
				},
			).pipe(Atom.setIdleTTL(0)),
		),
		save: Atom.family((contentHash: string) =>
			Atom.fn((artifact: EditorProjectBuildSchema.Type) =>
				artifact.contentHash !== contentHash
					? Effect.fail(new Error("The selected editor build artifact is stale."))
					: saveEditorBuildFx(artifact),
			).pipe(Atom.setIdleTTL(0)),
		),
	})),
);

export namespace useEditorBuildController {
	export type Status = "building" | "not-built" | "stale" | "valid";

	export interface Output {
		readonly artifactSummary?: string;
		readonly build: () => void;
		readonly buildFailure?: EditorBuildFailure;
		readonly buildPending: boolean;
		readonly buildStatus: Status;
		readonly buildStatusLabel: string;
		readonly buildSummary: string;
		readonly diagnostics: ReadonlyArray<EditorGameDiagnostic>;
		readonly installArtifact: () => void;
		readonly installAction: "install" | "update";
		readonly installAvailable: boolean;
		readonly installConfirmation?: EditorBuildMajorUpdateConfirmation;
		readonly cancelInstall: () => void;
		readonly confirmInstall: () => void;
		readonly installError?: string;
		readonly installPending: boolean;
		readonly installedPackageId?: string;
		readonly project: EditorProject;
		readonly saveArtifact: () => void;
		readonly saveError?: string;
		readonly savePending: boolean;
	}
}

export const useEditorBuildController = (): useEditorBuildController.Output => {
	const project = useEditorProject();
	const buildAtom = EditorBuildCommandAtoms.build(project.projectId);
	const buildResult = useAtomValue(buildAtom);
	const runBuild = useAtomSet(buildAtom);
	const builtArtifact =
		AsyncResult.isSuccess(buildResult) && !buildResult.waiting ? buildResult.value : undefined;
	const artifact = builtArtifact?.revision === project.revision ? builtArtifact : undefined;
	const artifactStale = builtArtifact !== undefined && artifact === undefined;
	const catalogState = useAtomValue(ArkpackCatalogAtom);
	const installPlan =
		artifact !== undefined && catalogState.type === "ready"
			? readEditorBuildInstallPlanFn({
					arkpacks: catalogState.arkpacks,
					artifact,
					targetVersion: project.version,
				})
			: undefined;
	const installAtom = EditorBuildCommandAtoms.install(artifact?.contentHash ?? "unbuilt");
	const saveAtom = EditorBuildCommandAtoms.save(artifact?.contentHash ?? "unbuilt");
	const installResult = useAtomValue(installAtom);
	const runInstall = useAtomSet(installAtom, {
		mode: "promise",
	});
	const saveResult = useAtomValue(saveAtom);
	const runSave = useAtomSet(saveAtom);
	const buildError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(buildResult));
	const installError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(installResult));
	const saveError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(saveResult));
	const buildFailure = readEditorBuildFailureFn(buildError);
	const diagnostics =
		buildFailure?.type === "validation"
			? buildFailure.diagnostics
			: (artifact?.diagnostics ?? emptyDiagnostics);
	const installErrorMessage = readErrorMessageFn(installError);
	const saveErrorMessage = readErrorMessageFn(saveError);
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
	const installedPackageId =
		AsyncResult.isSuccess(installResult) && !installResult.waiting
			? installResult.value.packageId
			: undefined;
	const [requestedInstallConfirmation, setRequestedInstallConfirmation] =
		useState<EditorBuildMajorUpdateConfirmation>();
	const installConfirmation =
		requestedInstallConfirmation?.targetContentHash === artifact?.contentHash
			? requestedInstallConfirmation
			: undefined;
	const build = useCallback(() => {
		runBuild({
			expectedRevision: project.revision,
		});
	}, [
		project.revision,
		runBuild,
	]);
	const saveArtifact = useCallback(() => {
		if (artifact !== undefined) runSave(artifact);
	}, [
		artifact,
		runSave,
	]);
	const runArtifactInstall = useCallback(
		async (confirmation?: EditorBuildMajorUpdateConfirmation) => {
			if (artifact === undefined) return;
			try {
				await runInstall({
					artifact,
					...(confirmation === undefined
						? {}
						: {
								confirmation,
							}),
					targetVersion: project.version,
				});
				if (confirmation !== undefined)
					setRequestedInstallConfirmation((current) =>
						current === confirmation ? undefined : current,
					);
			} catch {
				// The settled command error remains visible in the Build output or confirmation.
			}
		},
		[
			artifact,
			project.version,
			runInstall,
		],
	);
	const installArtifact = useCallback(() => {
		if (installResult.waiting || installPlan === undefined) return;
		if (installPlan.confirmation !== undefined) {
			setRequestedInstallConfirmation(installPlan.confirmation);
			return;
		}
		void runArtifactInstall();
	}, [
		installPlan,
		installResult.waiting,
		runArtifactInstall,
	]);
	const cancelInstall = useCallback(() => {
		if (!installResult.waiting && installConfirmation !== undefined)
			setRequestedInstallConfirmation((current) =>
				current === installConfirmation ? undefined : current,
			);
	}, [
		installConfirmation,
		installResult.waiting,
	]);
	const confirmInstall = useCallback(() => {
		if (!installResult.waiting && installConfirmation !== undefined)
			void runArtifactInstall(installConfirmation);
	}, [
		installConfirmation,
		installResult.waiting,
		runArtifactInstall,
	]);

	return useMemo(
		() => ({
			artifactSummary,
			build,
			buildFailure,
			buildPending: buildResult.waiting,
			buildStatus,
			buildStatusLabel: buildStatusLabels[buildStatus],
			buildSummary,
			diagnostics,
			cancelInstall,
			confirmInstall,
			installArtifact,
			installAction: installPlan?.action ?? "install",
			installAvailable: installPlan !== undefined,
			...(installConfirmation === undefined
				? {}
				: {
						installConfirmation,
					}),
			installError: installErrorMessage,
			installPending: installResult.waiting,
			installedPackageId,
			project,
			saveArtifact,
			saveError: saveErrorMessage,
			savePending: saveResult.waiting,
		}),
		[
			artifactSummary,
			build,
			buildFailure,
			buildResult.waiting,
			buildStatus,
			buildSummary,
			cancelInstall,
			confirmInstall,
			diagnostics,
			installArtifact,
			installConfirmation,
			installPlan,
			installErrorMessage,
			installResult.waiting,
			installedPackageId,
			project,
			saveArtifact,
			saveErrorMessage,
			saveResult.waiting,
		],
	);
};
