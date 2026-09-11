import { createFileRoute } from "@tanstack/react-router";
import { Download, PackageCheck, PackagePlus } from "lucide-react";

import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorBuildMajorUpdateDialog } from "~/editor-build/ui/EditorBuildMajorUpdateDialog";
import { EditorBuildStatus } from "~/editor-build/ui/EditorBuildStatus";
import { EditorBuildValidation } from "~/editor-build/ui/EditorBuildValidation";
import { useEditorBuildController } from "~/editor-build/ui/useEditorBuildController";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { formatVersionFn } from "~/game-version/fn/formatVersionFn";

export const Route = createFileRoute("/editor/$projectId/build")({
	component: () => {
		const controller = useEditorBuildController();
		const outputVersion =
			controller.artifact?.version ?? formatVersionFn(controller.project.version);
		const InstallIcon = controller.installAction === "update" ? PackageCheck : PackagePlus;
		const artifactSummary =
			controller.artifact === undefined
				? undefined
				: `${readArkpackArtifactNameFn(controller.artifact.projectId)} · ${formatByteSizeFn(controller.artifact.size)} · v${controller.artifact.version} · Arkini ${ArkiniAppVersion} · Community`;

		return (
			<EditorSectionPage
				contentMode="viewport"
				header={
					<EditorSectionNavigation
						action={
							<EditorPageHelp
								content={<Mx label="Build help" />}
								title={<Tx label="Build" />}
							/>
						}
						leading={
							<EditorHistoryBackButton
								params={{
									projectId: controller.project.projectId,
								}}
								to="/editor/$projectId/editor/items/list"
							/>
						}
						title={
							<h1 className="text-xl font-semibold">
								<Tx label="Build" />
							</h1>
						}
					/>
				}
			>
				<section
					className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
					data-ui="EditorBuild"
				>
					<div className="shrink-0">
						<EditorBuildStatus
							buildFailure={controller.buildFailure}
							canBuild={controller.canBuild}
							pending={controller.buildPending}
							stale={controller.buildStatus === "stale"}
							version={controller.version}
							versionError={controller.versionError}
							onMajorChangeFn={controller.setMajorFn}
							onMinorChangeFn={controller.setMinorFn}
							onSuffixChangeFn={controller.setSuffixFn}
							onBuildFn={controller.buildFn}
						/>
					</div>
					{artifactSummary === undefined ? null : (
						<article className="rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-5">
							<h2 className="text-lg font-semibold">Build output</h2>
							<p className="mt-2 break-all text-sm text-muted">{artifactSummary}</p>
							<div className="mt-4 flex items-center gap-3">
								<PrimaryButton
									className="shrink-0 whitespace-nowrap"
									data-ui="EditorBuildInstall"
									disabled={
										controller.installPending || !controller.installAvailable
									}
									cursorIntent={
										controller.installPending ? "progress" : undefined
									}
									onClick={controller.installArtifactFn}
								>
									<InstallIcon className="mr-2 size-4" />
									{controller.installAction === "update" ? "Update" : "Install"}
								</PrimaryButton>
								<Button
									className="shrink-0 whitespace-nowrap border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-surface-raised disabled:hover:bg-transparent"
									data-ui="EditorBuildSave"
									disabled={controller.savePending}
									cursorIntent={controller.savePending ? "progress" : undefined}
									onClick={controller.saveArtifactFn}
								>
									<Download className="mr-2 size-4" />
									Save as…
								</Button>
								{controller.installedPackageId === undefined ? null : (
									<p className="ml-auto min-w-0 truncate text-right text-sm text-success">
										Installed as <strong>{controller.installedPackageId}</strong>.
									</p>
								)}
							</div>
							{controller.saveError === undefined ? null : (
								<p className="mt-3 text-sm text-danger">{controller.saveError}</p>
							)}
							{controller.installError === undefined ? null : (
								<p className="mt-3 text-sm text-danger">
									{controller.installError}
								</p>
							)}
						</article>
					)}
					{controller.validationVisible && controller.diagnostics.length > 0 ? (
						<EditorBuildValidation
							diagnostics={controller.diagnostics}
							project={controller.project}
							version={outputVersion}
							onDismissFn={
								controller.artifact === undefined
									? undefined
									: controller.dismissValidationFn
							}
						/>
					) : null}
					{controller.installConfirmation === undefined ? null : (
						<EditorBuildMajorUpdateDialog
							confirmation={controller.installConfirmation}
							error={controller.installError}
							pending={controller.installPending}
							onCancelFn={controller.cancelInstallFn}
							onConfirmFn={controller.confirmInstallFn}
						/>
					)}
				</section>
			</EditorSectionPage>
		);
	},
});
