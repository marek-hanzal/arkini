import { createFileRoute } from "@tanstack/react-router";
import { Download, GitCommitHorizontal, PackageCheck, PackagePlus } from "lucide-react";

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
import { useTranslator } from "~/translation/ui/useTranslator";
import { Button, PrimaryButton, PrimaryButtonLink } from "~/ui/ui/Button";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { Status } from "~/ui/ui/Status";

export const Route = createFileRoute("/editor/$projectId/build")({
	component: () => {
		const controller = useEditorBuildController();
		const translator = useTranslator();
		const InstallIcon = controller.installAction === "update" ? PackageCheck : PackagePlus;
		const artifactSummary =
			controller.artifact === undefined
				? undefined
				: `${readArkpackArtifactNameFn(controller.artifact.projectId)} · ${formatByteSizeFn(controller.artifact.size)} · v${controller.project.version} · Arkini ${ArkiniAppVersion} · Community`;

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
					className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3"
					data-ui="EditorBuild"
				>
					{controller.commitRequired === true ? (
						<Status
							action={
								<PrimaryButtonLink
									className="gap-2"
									params={{
										projectId: controller.project.projectId,
									}}
									search={{
										returnTo: `/editor/${encodeURIComponent(controller.project.projectId)}/build`,
									}}
									to="/editor/$projectId/versions/commit"
								>
									<GitCommitHorizontal className="size-4" />
									<Tx label="Review and commit" />
								</PrimaryButtonLink>
							}
							dataUi="EditorBuildCommitRequired"
							description={translator.textFn("Build dirty description")}
							icon={GitCommitHorizontal}
							title={translator.textFn("Build dirty title")}
						/>
					) : (
						<>
							{artifactSummary === undefined ? null : (
								<article className="rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-5">
									<h2 className="text-lg font-semibold">Build output</h2>
									<p className="mt-2 break-all text-sm text-muted">
										{artifactSummary}
									</p>
									<div className="mt-4 flex flex-wrap gap-3">
										<PrimaryButton
											data-ui="EditorBuildInstall"
											disabled={
												controller.installPending ||
												!controller.installAvailable
											}
											cursorIntent={
												controller.installPending ? "progress" : undefined
											}
											onClick={controller.installArtifactFn}
										>
											<InstallIcon className="mr-2 size-4" />
											{controller.installAction === "update"
												? "Update"
												: "Install"}
										</PrimaryButton>
										<Button
											className="border-transparent bg-transparent shadow-none hover:border-transparent hover:bg-surface-raised disabled:hover:bg-transparent"
											data-ui="EditorBuildSave"
											disabled={controller.savePending}
											cursorIntent={
												controller.savePending ? "progress" : undefined
											}
											onClick={controller.saveArtifactFn}
										>
											<Download className="mr-2 size-4" />
											Save as…
										</Button>
									</div>
									{controller.saveError === undefined ? null : (
										<p className="mt-3 text-sm text-danger">
											{controller.saveError}
										</p>
									)}
									{controller.installError === undefined ? null : (
										<p className="mt-3 text-sm text-danger">
											{controller.installError}
										</p>
									)}
									{controller.installedPackageId === undefined ? null : (
										<p className="mt-3 text-sm text-success">
											Installed as {controller.installedPackageId}.
										</p>
									)}
								</article>
							)}
							{controller.artifact === undefined ? (
								<div className="shrink-0">
									<EditorBuildStatus
										buildFailure={controller.buildFailure}
										canBuild={controller.canBuild}
										pending={controller.buildPending}
										stale={controller.buildStatus === "stale"}
										version={controller.project.version}
										versionStatusError={controller.versionStatusError}
										onBuildFn={controller.buildFn}
									/>
								</div>
							) : null}
							{controller.validationVisible && controller.diagnostics.length > 0 ? (
								<EditorBuildValidation
									diagnostics={controller.diagnostics}
									project={controller.project}
									version={controller.project.version}
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
						</>
					)}
				</section>
			</EditorSectionPage>
		);
	},
});
