import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { buildEditorProjectCommandAtom } from "~/bridge/arkpack/editor/buildEditorProjectCommandAtom";
import { installBuiltEditorArkpackCommandAtom } from "~/bridge/arkpack/editor/installBuiltEditorArkpackCommandAtom";
import { readEditorBuildDiagnostics } from "~/bridge/arkpack/editor/readEditorBuildDiagnostics";
import { saveBuiltEditorArkpackCommandAtom } from "~/bridge/arkpack/editor/saveBuiltEditorArkpackCommandAtom";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { Button, PrimaryButton } from "~/ui/button/Button";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";

/** Owns explicit heavy validation and independent output actions for one project snapshot. */
export const EditorBuild = () => {
	const project = useEditorProject();
	const buildAtom = buildEditorProjectCommandAtom(project.projectId);
	const buildResult = useAtomValue(buildAtom);
	const build = useAtomSet(buildAtom);
	const builtArtifact =
		AsyncResult.isSuccess(buildResult) && !buildResult.waiting ? buildResult.value : undefined;
	const artifact = builtArtifact?.revision === project.revision ? builtArtifact : undefined;
	const artifactStale = builtArtifact !== undefined && artifact === undefined;
	const installAtom = installBuiltEditorArkpackCommandAtom(artifact?.contentHash ?? "unbuilt");
	const saveAtom = saveBuiltEditorArkpackCommandAtom(artifact?.contentHash ?? "unbuilt");
	const installResult = useAtomValue(installAtom);
	const install = useAtomSet(installAtom);
	const saveResult = useAtomValue(saveAtom);
	const save = useAtomSet(saveAtom);
	const buildError = readSettledAsyncResultError(buildResult);
	const installError = readSettledAsyncResultError(installResult);
	const saveError = readSettledAsyncResultError(saveResult);
	const errorDiagnostics = readEditorBuildDiagnostics(buildError);
	const diagnostics = errorDiagnostics ?? artifact?.diagnostics ?? [];

	return (
		<section
			className="grid h-full min-h-0 content-start gap-[var(--ak-viewport-gap)] overflow-y-auto overscroll-contain"
			aria-labelledby="editor-build-title"
			data-ui="EditorBuild"
		>
			<header>
				<h1
					id="editor-build-title"
					className="text-2xl font-semibold"
				>
					Build
				</h1>
				<p className="mt-1 text-sm text-muted">
					Validate one exact saved project snapshot and produce immutable Arkpack bytes.
				</p>
			</header>
			<article className="rounded-2xl border border-line bg-surface/85 p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold">Project validation</h2>
						<p className="mt-1 text-sm text-muted">
							{artifact === undefined
								? artifactStale
									? "The project changed after the last build. Build the current revision again."
									: "Run a build to execute the complete game and resource validation."
								: `Revision ${artifact.revision} built with ${artifact.diagnostics.length} non-blocking diagnostic${artifact.diagnostics.length === 1 ? "" : "s"}.`}
						</p>
					</div>
					<span
						className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${artifact === undefined ? "bg-surface-raised text-muted" : "bg-success/15 text-success"}`}
					>
						{buildResult.waiting
							? "Building"
							: artifact === undefined
								? artifactStale
									? "Stale"
									: "Not built"
								: "Valid"}
					</span>
				</div>
				{buildError !== undefined && errorDiagnostics === undefined ? (
					<p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">
						{buildError instanceof Error ? buildError.message : String(buildError)}
					</p>
				) : null}
				{diagnostics.length === 0 ? null : (
					<ul className="mt-4 grid gap-2">
						{diagnostics.map((diagnostic, index) => (
							<li
								key={`${diagnostic.code}-${diagnostic.source ?? "project"}-${index}`}
								className="rounded-lg bg-surface-raised p-3 text-sm text-muted"
							>
								<span className="font-semibold text-foreground">
									{diagnostic.code}
								</span>
								: {diagnostic.message}
							</li>
						))}
					</ul>
				)}
				<PrimaryButton
					className="mt-4"
					disabled={buildResult.waiting}
					cursorIntent={buildResult.waiting ? "progress" : undefined}
					onClick={() => build(undefined)}
				>
					{buildResult.waiting ? "Building…" : "Build arkpack"}
				</PrimaryButton>
			</article>
			{artifact === undefined ? null : (
				<article className="rounded-2xl border border-line bg-surface/85 p-5">
					<h2 className="text-lg font-semibold">Build output</h2>
					<p className="mt-2 break-all text-sm text-muted">
						{artifact.filename} · {artifact.bytes.byteLength} bytes ·{" "}
						{artifact.contentHash}
					</p>
					<div className="mt-4 flex flex-wrap gap-3">
						<Button
							disabled={saveResult.waiting}
							cursorIntent={saveResult.waiting ? "progress" : undefined}
							onClick={() => save(artifact)}
						>
							{saveResult.waiting ? "Saving…" : "Save as…"}
						</Button>
						<PrimaryButton
							disabled={installResult.waiting}
							cursorIntent={installResult.waiting ? "progress" : undefined}
							onClick={() => install(artifact)}
						>
							{installResult.waiting ? "Installing…" : "Install to game catalog"}
						</PrimaryButton>
					</div>
					{saveError === undefined ? null : (
						<p className="mt-3 text-sm text-danger">
							{saveError instanceof Error ? saveError.message : String(saveError)}
						</p>
					)}
					{installError === undefined ? null : (
						<p className="mt-3 text-sm text-danger">
							{installError instanceof Error
								? installError.message
								: String(installError)}
						</p>
					)}
					{AsyncResult.isSuccess(installResult) && !installResult.waiting ? (
						<p className="mt-3 text-sm text-success">
							Installed as {installResult.value.packageId}.
						</p>
					) : null}
				</article>
			)}
		</section>
	);
};
