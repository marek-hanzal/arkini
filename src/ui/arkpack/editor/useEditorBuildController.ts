import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { match, P } from "ts-pattern";

import { buildEditorProjectCommandAtom } from "~/bridge/arkpack/editor/buildEditorProjectCommandAtom";
import { installBuiltEditorArkpackCommandAtom } from "~/bridge/arkpack/editor/installBuiltEditorArkpackCommandAtom";
import {
	type EditorGameDiagnostic,
	readEditorBuildDiagnosticsFx,
} from "~/bridge/arkpack/editor/readEditorBuildDiagnosticsFx";
import { saveBuiltEditorArkpackCommandAtom } from "~/bridge/arkpack/editor/saveBuiltEditorArkpackCommandAtom";
import { exportEditorJsonDirectoryCommandAtom } from "~/bridge/editor/exportEditorJsonDirectoryCommandAtom";
import type { EditorSourceExport } from "~/bridge/editor/exportEditorJsonDirectoryFx";
import { openEditorExportDirectoryCommandAtom } from "~/bridge/editor/openEditorExportDirectoryCommandAtom";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
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
		readonly buildError?: string;
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
		readonly signKeyConfigured: boolean;
		readonly signKey: string;
		readonly setSignKey: (value: string) => void;
	}
}

export const useEditorBuildController = (): useEditorBuildController.Output => {
	const project = useEditorProject();
	const [signKey, setSignKeyState] = useState("");
	const [signKeyConfigured, setSignKeyConfigured] = useState(false);
	useEffect(() => {
		let active = true;
		void window.arkini.editor
			.isSignKeyConfigured()
			.then((value) => {
				if (active) setSignKeyConfigured(value);
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, []);
	const setSignKey = useCallback((value: string) => {
		setSignKeyState(value);
	}, []);
	const buildAtom = buildEditorProjectCommandAtom(project.projectId);
	const buildResult = useAtomValue(buildAtom);
	const runBuild = useAtomSet(buildAtom);
	const builtArtifact =
		AsyncResult.isSuccess(buildResult) && !buildResult.waiting ? buildResult.value : undefined;
	const artifact = builtArtifact?.revision === project.revision ? builtArtifact : undefined;
	const artifactStale = builtArtifact !== undefined && artifact === undefined;
	const installAtom = installBuiltEditorArkpackCommandAtom(artifact?.contentHash ?? "unbuilt");
	const saveAtom = saveBuiltEditorArkpackCommandAtom(artifact?.contentHash ?? "unbuilt");
	const installResult = useAtomValue(installAtom);
	const runInstall = useAtomSet(installAtom);
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
	const errorDiagnostics = RendererRuntime.runSync(readEditorBuildDiagnosticsFx(buildError));
	const diagnostics = errorDiagnostics ?? artifact?.diagnostics ?? emptyDiagnostics;
	const buildErrorMessage = errorDiagnostics === undefined ? errorMessage(buildError) : undefined;
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
				readonly value: EditorSourceExport;
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
				`${currentArtifact.filename} · ${RendererRuntime.runSync(formatByteSizeFx(currentArtifact.bytes))} · v${currentArtifact.version} · Arkini ${currentArtifact.game} · ${currentArtifact.signatureFilename === undefined ? "unsigned" : "signed"} · ${currentArtifact.contentHash}`,
		)
		.otherwise(() => undefined);
	const installedPackageId =
		AsyncResult.isSuccess(installResult) && !installResult.waiting
			? installResult.value.packageId
			: undefined;
	const build = useCallback(() => {
		const candidate = signKey.trim();
		runBuild({
			expectedRevision: project.revision,
			...(candidate.length === 0
				? {}
				: {
						signKey: candidate,
					}),
		});
	}, [
		project.revision,
		runBuild,
		signKey,
	]);
	const saveArtifact = useCallback(() => {
		if (artifact !== undefined) runSave(artifact);
	}, [
		artifact,
		runSave,
	]);
	const installArtifact = useCallback(() => {
		if (artifact !== undefined) runInstall(artifact);
	}, [
		artifact,
		runInstall,
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
			buildError: buildErrorMessage,
			buildPending: buildResult.waiting,
			buildStatus,
			buildStatusLabel: buildStatusLabels[buildStatus],
			buildSummary,
			diagnostics,
			exportSource,
			exportSourceError: exportSourceErrorMessage,
			exportSourcePending: exportSourceResult.waiting,
			exportSourceSummary,
			installArtifact,
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
			signKeyConfigured,
			signKey,
			setSignKey,
		}),
		[
			artifactSummary,
			build,
			buildErrorMessage,
			buildResult.waiting,
			buildStatus,
			buildSummary,
			diagnostics,
			exportSource,
			exportSourceErrorMessage,
			exportSourceResult.waiting,
			exportSourceSummary,
			installArtifact,
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
			signKeyConfigured,
			setSignKey,
			signKey,
		],
	);
};
