import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback, useMemo, useRef, useState } from "react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { match, P } from "ts-pattern";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";

import { buildEditorProjectCommandAtom } from "~/ui/arkpack/editor/buildEditorProjectCommandAtom";
import { installBuiltEditorArkpackCommandAtom } from "~/ui/arkpack/editor/installBuiltEditorArkpackCommandAtom";
import {
	type EditorBuildMajorUpdateConfirmation,
	readEditorBuildInstallPlanFn,
} from "~/editor/build/fn/readEditorBuildInstallPlanFn";
import {
	type EditorBuildFailure,
	type EditorGameDiagnostic,
	readEditorBuildFailureFn,
} from "~/editor/build/fn/readEditorBuildFailureFn";
import { saveBuiltEditorArkpackCommandAtom } from "~/ui/arkpack/editor/saveBuiltEditorArkpackCommandAtom";
import { ArkpackCatalogAtom } from "~/ui/arkpack/ArkpackCatalogAtom";
import { readArkpackArtifactNameFn } from "~/engine/pack/fn/readArkpackArtifactNameFn";
import { exportEditorJsonDirectoryCommandAtom } from "~/ui/editor/exportEditorJsonDirectoryCommandAtom";
import type { EditorProjectTransport } from "../../../../electron/contract/editor/EditorProjectTransport";
import { openEditorExportDirectoryCommandAtom } from "~/ui/editor/openEditorExportDirectoryCommandAtom";
import type { EditorProject } from "~/editor/EditorProject";
import { useEditorProject } from "~/ui/editor/useEditorProject";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { formatByteSizeFx } from "~/ui/arkpack/editor/formatByteSizeFx";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";

const emptyDiagnostics: ReadonlyArray<EditorGameDiagnostic> = [];

const errorMessage = (error: unknown) =>
	error === undefined ? undefined : error instanceof Error ? error.message : String(error);

const buildStatusLabels = {
	building: "Building",
	"not-built": "Not built",
	stale: "Stale",
	valid: "Valid",
} as const;

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
		readonly exportSource: () => void;
		readonly exportSourceError?: string;
		readonly exportSourcePending: boolean;
		readonly exportSourceSummary?: string;
		readonly installArtifact: () => void;
		readonly installAction: "install" | "update";
		readonly installAvailable: boolean;
		readonly installConfirmation?: EditorBuildMajorUpdateConfirmation;
		readonly cancelInstall: () => void;
		readonly confirmInstall: () => void;
		readonly installError?: string;
		readonly installPending: boolean;
		readonly installedPackageId?: string;
		readonly openSourceExport: () => void;
		readonly openSourceExportAvailable: boolean;
		readonly openSourceExportError?: string;
		readonly openSourceExportPending: boolean;
		readonly project: EditorProject;
		readonly saveArtifact: () => void;
		readonly saveError?: string;
		readonly savePending: boolean;
	}
}

export const useEditorBuildController = (): useEditorBuildController.Output => {
	const project = useEditorProject();
	const buildAtom = buildEditorProjectCommandAtom(project.projectId);
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
	const installAtom = installBuiltEditorArkpackCommandAtom(artifact?.contentHash ?? "unbuilt");
	const saveAtom = saveBuiltEditorArkpackCommandAtom(artifact?.contentHash ?? "unbuilt");
	const installResult = useAtomValue(installAtom);
	const runInstall = useAtomSet(installAtom, {
		mode: "promise",
	});
	const saveResult = useAtomValue(saveAtom);
	const runSave = useAtomSet(saveAtom);
	const exportSourceAtom = exportEditorJsonDirectoryCommandAtom(project.projectId);
	const exportSourceResult = useAtomValue(exportSourceAtom);
	const runSourceExport = useAtomSet(exportSourceAtom);
	const buildError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(buildResult));
	const installError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(installResult));
	const saveError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(saveResult));
	const exportSourceError = RendererRuntime.runSync(
		readSettledAsyncResultErrorFx(exportSourceResult),
	);
	const buildFailure = readEditorBuildFailureFn(buildError);
	const diagnostics =
		buildFailure?.type === "validation"
			? buildFailure.diagnostics
			: (artifact?.diagnostics ?? emptyDiagnostics);
	const installErrorMessage = errorMessage(installError);
	const saveErrorMessage = errorMessage(saveError);
	const exportSourceErrorMessage = errorMessage(exportSourceError);
	const completedSourceExport =
		AsyncResult.isSuccess(exportSourceResult) && !exportSourceResult.waiting
			? exportSourceResult.value
			: undefined;
	const sourceExportRef = useRef<
		| {
				readonly projectId: string;
				readonly value: EditorProjectTransport.SourceExport;
		  }
		| undefined
	>(undefined);
	if (sourceExportRef.current?.projectId !== project.projectId) {
		sourceExportRef.current = undefined;
	}
	if (completedSourceExport !== undefined && completedSourceExport !== null) {
		sourceExportRef.current = {
			projectId: project.projectId,
			value: completedSourceExport,
		};
	}
	const sourceExport = sourceExportRef.current?.value;
	const openSourceExportResult = useAtomValue(openEditorExportDirectoryCommandAtom);
	const runOpenSourceExport = useAtomSet(openEditorExportDirectoryCommandAtom);
	const openSourceExportError = RendererRuntime.runSync(
		readSettledAsyncResultErrorFx(openSourceExportResult),
	);
	const openSourceExportErrorMessage = errorMessage(openSourceExportError);
	const exportSourceSummary =
		sourceExport === undefined
			? undefined
			: `Exported revision ${sourceExport.revision}: ${sourceExport.json} JSON files and ${sourceExport.resources} PNG resources to ${sourceExport.root}.`;
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
				`${readArkpackArtifactNameFn(currentArtifact.projectId)} · ${RendererRuntime.runSync(formatByteSizeFx(currentArtifact.size))} · v${project.version} · Arkini ${ArkiniAppVersion} · Community · ${currentArtifact.contentHash}`,
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
	const exportSource = useCallback(() => {
		runSourceExport(undefined);
	}, [
		runSourceExport,
	]);
	const openSourceExport = useCallback(() => {
		if (sourceExport !== undefined) runOpenSourceExport(undefined);
	}, [
		runOpenSourceExport,
		sourceExport,
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
			exportSource,
			exportSourceError: exportSourceErrorMessage,
			exportSourcePending: exportSourceResult.waiting,
			exportSourceSummary,
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
			openSourceExport,
			openSourceExportAvailable: sourceExport !== undefined,
			openSourceExportError: openSourceExportErrorMessage,
			openSourceExportPending: openSourceExportResult.waiting,
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
			exportSource,
			exportSourceErrorMessage,
			exportSourceResult.waiting,
			exportSourceSummary,
			installArtifact,
			installConfirmation,
			installPlan,
			installErrorMessage,
			installResult.waiting,
			installedPackageId,
			openSourceExport,
			openSourceExportErrorMessage,
			openSourceExportResult.waiting,
			project,
			sourceExport,
			saveArtifact,
			saveErrorMessage,
			saveResult.waiting,
		],
	);
};
