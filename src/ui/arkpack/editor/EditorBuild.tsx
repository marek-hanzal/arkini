import { EditorBuildDiagnostics } from "~/ui/arkpack/editor/EditorBuildDiagnostics";
import { useEditorBuildController } from "~/ui/arkpack/editor/useEditorBuildController";
import { Button, PrimaryButton } from "~/ui/button/Button";

export const EditorBuild = () => {
	const controller = useEditorBuildController();

	return (
		<section
			className="grid h-full min-h-0 content-start gap-3 overflow-y-auto overscroll-contain p-3"
			data-ui="EditorBuild"
		>
			<header>
				<h1 className="text-2xl font-semibold">Build</h1>
				<p className="mt-1 text-sm text-muted">
					Validate one exact saved project snapshot and produce immutable Arkpack bytes.
				</p>
				<p className="mt-1 text-xs text-subtle">
					Arkpack v{controller.project.version}. Compatible edits keep saves and Board
					scenarios; a major project save permanently deletes its scenarios and published
					game saves start fresh when loaded.
				</p>
			</header>
			<article className="rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold">Project validation</h2>
						<p className="mt-1 text-sm text-muted">{controller.buildSummary}</p>
					</div>
					<span
						className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${controller.buildStatus === "valid" ? "bg-success/15 text-success" : "bg-surface-raised text-muted"}`}
					>
						{controller.buildStatusLabel}
					</span>
				</div>
				{controller.buildError === undefined ? null : (
					<p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">
						{controller.buildError}
					</p>
				)}
				{controller.diagnostics.length === 0 ? null : (
					<EditorBuildDiagnostics
						diagnostics={controller.diagnostics}
						project={controller.project}
					/>
				)}
				<PrimaryButton
					className="mt-4"
					disabled={controller.buildPending}
					cursorIntent={controller.buildPending ? "progress" : undefined}
					onClick={controller.build}
				>
					{controller.buildPending ? "Building…" : "Build arkpack"}
				</PrimaryButton>
			</article>
			{controller.artifactSummary === undefined ? null : (
				<article className="rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-5">
					<h2 className="text-lg font-semibold">Build output</h2>
					<p className="mt-2 break-all text-sm text-muted">
						{controller.artifactSummary}
					</p>
					<div className="mt-4 flex flex-wrap gap-3">
						<Button
							data-ui="EditorBuildSave"
							disabled={controller.savePending}
							cursorIntent={controller.savePending ? "progress" : undefined}
							onClick={controller.saveArtifact}
						>
							{controller.savePending ? "Saving…" : "Save as…"}
						</Button>
						<PrimaryButton
							data-ui="EditorBuildInstall"
							disabled={controller.installPending}
							cursorIntent={controller.installPending ? "progress" : undefined}
							onClick={controller.installArtifact}
						>
							{controller.installPending ? "Installing…" : "Install"}
						</PrimaryButton>
					</div>
					{controller.saveError === undefined ? null : (
						<p className="mt-3 text-sm text-danger">{controller.saveError}</p>
					)}
					{controller.installError === undefined ? null : (
						<p className="mt-3 text-sm text-danger">{controller.installError}</p>
					)}
					{controller.installedPackageId === undefined ? null : (
						<p className="mt-3 text-sm text-success">
							Installed as {controller.installedPackageId}.
						</p>
					)}
				</article>
			)}
		</section>
	);
};
