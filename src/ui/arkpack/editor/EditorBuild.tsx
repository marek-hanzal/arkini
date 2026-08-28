import { EditorBuildDiagnostics } from "~/ui/arkpack/editor/EditorBuildDiagnostics";
import { EditorBuildMajorUpdateDialog } from "~/ui/arkpack/editor/EditorBuildMajorUpdateDialog";
import { useEditorBuildController } from "~/ui/arkpack/editor/useEditorBuildController";
import { Button, PrimaryButton } from "~/ui/button/Button";
import { EditorHistoryBackButton } from "~/ui/editor/EditorHistoryBackButton";

export const EditorBuild = () => {
	const controller = useEditorBuildController();

	return (
		<section
			className="grid h-full min-h-0 content-start gap-3 overflow-y-auto overscroll-contain p-3"
			data-ui="EditorBuild"
		>
			<header className="flex items-start gap-2">
				<EditorHistoryBackButton
					params={{
						projectId: controller.project.projectId,
					}}
					to="/editor/$projectId/editor/items/list"
				/>
				<div>
					<h1 className="text-2xl font-semibold">Build</h1>
					<p className="mt-1 text-sm text-muted">
						Validate one exact saved project revision and publish its canonical Arkpack.
					</p>
					<p className="mt-1 text-xs text-subtle">
						Arkpack v{controller.project.version}. Compatible edits keep saves and Board
						scenarios; a major project save permanently deletes its scenarios and
						existing published game saves remain stored but cannot be restored.
					</p>
				</div>
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
				{controller.buildFailure?.type === "operational" ? (
					<div className="mt-4 rounded-lg bg-danger/10 p-3 text-danger">
						<h3 className="text-sm font-semibold">Build operation failed</h3>
						<p className="mt-1 text-sm">{controller.buildFailure.detail}</p>
					</div>
				) : controller.buildFailure?.type === "validation" ? (
					<p className="mt-4 text-sm font-medium text-danger">
						Project validation blocked the Arkpack build.
					</p>
				) : null}
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
					<span className="icon-[lucide--package-check] mr-2 size-4" />
					Build
				</PrimaryButton>
			</article>
			{controller.artifactSummary === undefined ? null : (
				<article className="rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-5">
					<h2 className="text-lg font-semibold">Build output</h2>
					<p className="mt-2 break-all text-sm text-muted">
						{controller.artifactSummary}
					</p>
					<div className="mt-4 flex flex-wrap gap-3">
						<PrimaryButton
							data-ui="EditorBuildInstall"
							disabled={controller.installPending || !controller.installAvailable}
							cursorIntent={controller.installPending ? "progress" : undefined}
							onClick={controller.installArtifact}
						>
							<span
								className={`${controller.installAction === "update" ? "icon-[lucide--package-check]" : "icon-[lucide--package-plus]"} mr-2 size-4`}
							/>
							{controller.installAction === "update" ? "Update" : "Install"}
						</PrimaryButton>
						<Button
							className="border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-surface-raised disabled:hover:bg-transparent"
							data-ui="EditorBuildSave"
							disabled={controller.savePending}
							cursorIntent={controller.savePending ? "progress" : undefined}
							onClick={controller.saveArtifact}
						>
							<span className="icon-[lucide--download] mr-2 size-4" />
							Save as…
						</Button>
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
			<article className="rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-5">
				<h2 className="text-lg font-semibold">Editor project export</h2>
				<p className="mt-1 text-sm text-muted">
					Copies the complete saved Editor folder, including assets, notes, scenarios, and
					version history. The exported folder can be opened directly by the Editor.
				</p>
				<div className="mt-4 flex flex-wrap gap-3">
					<PrimaryButton
						data-ui="EditorBuildExportSource"
						disabled={controller.exportSourcePending}
						cursorIntent={controller.exportSourcePending ? "progress" : undefined}
						onClick={controller.exportSource}
					>
						<span className="icon-[lucide--folder-output] mr-2 size-4" />
						Export
					</PrimaryButton>
					{controller.openSourceExportAvailable ? (
						<Button
							data-ui="EditorBuildOpenSourceExport"
							disabled={controller.openSourceExportPending}
							cursorIntent={
								controller.openSourceExportPending ? "progress" : undefined
							}
							onClick={controller.openSourceExport}
						>
							Open folder
						</Button>
					) : null}
				</div>
				{controller.exportSourceError === undefined ? null : (
					<p className="mt-3 text-sm text-danger">{controller.exportSourceError}</p>
				)}
				{controller.exportSourceSummary === undefined ? null : (
					<p className="mt-3 break-all text-sm text-success">
						{controller.exportSourceSummary}
					</p>
				)}
				{controller.openSourceExportError === undefined ? null : (
					<p className="mt-3 text-sm text-danger">{controller.openSourceExportError}</p>
				)}
			</article>
			{controller.installConfirmation === undefined ? null : (
				<EditorBuildMajorUpdateDialog
					confirmation={controller.installConfirmation}
					error={controller.installError}
					pending={controller.installPending}
					onCancel={controller.cancelInstall}
					onConfirm={controller.confirmInstall}
				/>
			)}
		</section>
	);
};
