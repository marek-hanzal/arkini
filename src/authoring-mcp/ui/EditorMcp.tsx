import { ShortcutLabel } from "~/ui/ui/ShortcutLabel";
import { formatForDisplay } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { Tooltip } from "~/ui/ui/Tooltip";
import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Check, Copy, RefreshCw } from "lucide-react";
import { match } from "ts-pattern";

import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useCopyButtonController } from "~/ui/ui/useCopyButtonController";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { LinkButton, LinkButtonLink } from "~/ui/ui/LinkButton";
import { sectionLinkClassName } from "~/ui/constant/SectionLinkClassName";
import { EditorMcpSections, type EditorMcpSectionId } from "./EditorMcpSections";
import { EditorMcpServer } from "./EditorMcpServer";
import { EditorMcpSettings } from "./EditorMcpSettings";
import { EditorMcpStatus } from "./EditorMcpStatus";
import { useEditorMcpOverviewController } from "./useEditorMcpOverviewController";
import { useEditorMcpSettingsController } from "./useEditorMcpSettingsController";

export const EditorMcp = ({ section }: { readonly section: EditorMcpSectionId }) => {
	const translator = useTranslator();
	const project = useEditorProject();
	const navigateFn = useNavigate();
	useSectionShortcuts({
		options: EditorMcpSections,
		onSelectFn: (candidate) => {
			void navigateFn({
				to: "/editor/$projectId/mcp/$sectionId",
				params: {
					projectId: project.projectId,
					sectionId: candidate.id,
				},
			});
		},
	});
	const overviewController = useEditorMcpOverviewController();
	const settingsController = useEditorMcpSettingsController({
		onConfigureFn: overviewController.configureFn,
		overview: overviewController.overview,
	});
	const overview = overviewController.overview;
	const passwordCopy = useCopyButtonController({
		value: overview?.remotePassword ?? "",
	});
	const PasswordCopyIcon = passwordCopy.copied ? Check : Copy;
	const error = settingsController.error ?? overviewController.commandError;
	const executeFn = (commandFn: () => void) => {
		settingsController.clearErrorFn();
		commandFn();
	};
	return (
		<section
			className="h-full min-h-0"
			data-ui="EditorMcp"
		>
			<EditorSectionPage
				header={
					<EditorSectionNavigation
						leading={
							<EditorHistoryBackButton
								params={{
									projectId: project.projectId,
								}}
								to="/editor/$projectId/editor/items/list"
							/>
						}
						title={<h1 className="text-xl font-semibold">MCP</h1>}
					/>
				}
				secondaryNavigation={
					<EditorSectionBar
						actions={
							section === "server" && overview !== undefined ? (
								<>
									<LinkButton
										className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
										title={
											passwordCopy.error ??
											translator.textFn(
												passwordCopy.copied ? "Copied" : "Copy password",
											)
										}
										onClick={() => void passwordCopy.copyFn()}
									>
										<PasswordCopyIcon className="size-4" />
										<Tx label="Copy password" />
									</LinkButton>
									<LinkButton
										className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
										data-ui="EditorMcpResetPassword"
										disabled={overviewController.pending}
										onClick={() => executeFn(overviewController.resetAuthFn)}
									>
										<RefreshCw className="size-4" />
										<Tx label="Reset password" />
									</LinkButton>
								</>
							) : null
						}
						help={
							<EditorPageHelp
								content={<Mx label="Editor MCP help" />}
								title={<Tx label="Editor MCP" />}
							/>
						}
					>
						{EditorMcpSections.map((candidate) => (
							<Tooltip
								key={candidate.id}
								content={`${translator.textFn(candidate.label)} · ${formatForDisplay(
									{
										key: candidate.shortcut,
									},
								)}`}
								placement="bottom"
							>
								<LinkButtonLink
									to="/editor/$projectId/mcp/$sectionId"
									params={{
										projectId: project.projectId,
										sectionId: candidate.id,
									}}
									activeOptions={{
										exact: true,
									}}
									activeProps={{
										"data-ui-selected": true,
									}}
									className={sectionLinkClassName}
								>
									<ShortcutLabel
										label={translator.textFn(candidate.label)}
										shortcut={candidate.shortcut}
									/>
								</LinkButtonLink>
							</Tooltip>
						))}
					</EditorSectionBar>
				}
			>
				<div className="mx-auto grid max-w-5xl gap-6">
					{error === undefined ? null : (
						<EditorMcpStatus
							message={error}
							tone="danger"
						/>
					)}
					{overview === undefined ? (
						<EditorMcpStatus
							message={translator.textFn("Loading MCP settings\u2026")}
						/>
					) : (
						match(section)
							.with("server", () => (
								<EditorMcpServer
									startingLocal={overviewController.startingLocal}
									onStartLocalFn={() =>
										executeFn(overviewController.startLocalFn)
									}
									onStartRemoteFn={() =>
										executeFn(overviewController.startRemoteFn)
									}
									onStopLocalFn={() => executeFn(overviewController.stopLocalFn)}
									onStopRemoteFn={() =>
										executeFn(overviewController.stopRemoteFn)
									}
									overview={overview}
									pending={overviewController.pending}
								/>
							))
							.with("local", "ngrok", (settingsSection) => (
								<EditorMcpSettings
									section={settingsSection}
									authtoken={settingsController.authtoken}
									ngrokDomain={settingsController.ngrokDomain}
									onSaveNgrokFn={settingsController.saveNgrokFn}
									onSavePortFn={settingsController.savePortFn}
									onSetAuthtokenFn={settingsController.setAuthtokenFn}
									onSetNgrokDomainFn={settingsController.setNgrokDomainFn}
									onSetPortFn={settingsController.setPortFn}
									overview={overview}
									pending={overviewController.pending}
									port={settingsController.port}
								/>
							))
							.exhaustive()
					)}
				</div>
			</EditorSectionPage>
		</section>
	);
};
