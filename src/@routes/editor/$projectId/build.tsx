import { createFileRoute } from "@tanstack/react-router";
import { Download, PackageCheck, PackagePlus } from "lucide-react";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";
import { EditorBuildDiagnostics } from "~/editor-build/ui/EditorBuildDiagnostics";
import { EditorBuildMajorUpdateDialog } from "~/editor-build/ui/EditorBuildMajorUpdateDialog";
import { useEditorBuildController } from "~/editor-build/ui/useEditorBuildController";
import { Button, PrimaryButton } from "~/ui/button/Button";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorProjectExport } from "~/project-authoring/ui/EditorProjectExport";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

const buildStatusLabels = {
	building: "Building",
	"not-built": "Not built",
	stale: "Stale",
	valid: "Valid",
} as const;

export const Route = createFileRoute("/editor/$projectId/build")({
	component: () => {
		const controller = useEditorBuildController();
		const InstallIcon = controller.installAction === "update" ? PackageCheck : PackagePlus;
		const buildSummary =
			controller.artifact !== undefined
				? `Revision ${controller.artifact.revision} built with ${controller.artifact.diagnostics.length} non-blocking diagnostic${controller.artifact.diagnostics.length === 1 ? "" : "s"}.`
				: controller.buildStatus === "stale"
					? "The project changed after the last build. Build the current revision again."
					: "Run a build to execute the complete game and resource validation.";
		const artifactSummary =
			controller.artifact === undefined
				? undefined
				: `${readArkpackArtifactNameFn(controller.artifact.projectId)} · ${formatByteSizeFn(controller.artifact.size)} · v${controller.project.version} · Arkini ${ArkiniAppVersion} · Community · ${controller.artifact.contentHash}`;

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
							Validate one exact saved project revision and publish its canonical
							Arkpack.
						</p>
						<p className="mt-1 text-xs text-subtle">
							Arkpack v{controller.project.version}. Board scenarios remain stored
							across project updates. A major save makes older scenarios and published
							game saves incompatible with the new gameplay version without deleting
							them.
						</p>
					</div>
				</header>
				<article className="rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-5">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold">Project validation</h2>
							<p className="mt-1 text-sm text-muted">{buildSummary}</p>
						</div>
						<span
							className="rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold text-muted uppercase tracking-wider data-[ui-status=valid]:bg-success/15 data-[ui-status=valid]:text-success"
							{...readDataUiFn({
								dataUi: "EditorBuildStatus",
								state: {
									status: controller.buildStatus,
								},
							})}
						>
							{buildStatusLabels[controller.buildStatus]}
						</span>
					</div>
					{controller.buildFailure?.type === "operational" ? (
						<div className="mt-4 rounded-lg bg-danger/10 p-3 text-danger">
							<h3 className="text-sm font-semibold">Build operation failed</h3>
							<p className="mt-1 text-sm">
								{controller.buildFailure.detail ??
									"The Editor project could not be built because of an unknown error."}
							</p>
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
						<PackageCheck className="mr-2 size-4" />
						Build
					</PrimaryButton>
				</article>
				{artifactSummary === undefined ? null : (
					<article className="rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-5">
						<h2 className="text-lg font-semibold">Build output</h2>
						<p className="mt-2 break-all text-sm text-muted">{artifactSummary}</p>
						<div className="mt-4 flex flex-wrap gap-3">
							<PrimaryButton
								data-ui="EditorBuildInstall"
								disabled={controller.installPending || !controller.installAvailable}
								cursorIntent={controller.installPending ? "progress" : undefined}
								onClick={controller.installArtifact}
							>
								<InstallIcon className="mr-2 size-4" />
								{controller.installAction === "update" ? "Update" : "Install"}
							</PrimaryButton>
							<Button
								className="border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-surface-raised disabled:hover:bg-transparent"
								data-ui="EditorBuildSave"
								disabled={controller.savePending}
								cursorIntent={controller.savePending ? "progress" : undefined}
								onClick={controller.saveArtifact}
							>
								<Download className="mr-2 size-4" />
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
				<EditorProjectExport projectId={controller.project.projectId} />
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
	},
});
