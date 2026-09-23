import { ShortcutLabel } from "~/ui/ui/ShortcutLabel";
import { EditorAudioPreviewPlayer } from "~/audio-authoring/ui/EditorAudioPreviewPlayer";
import { Overlay } from "~/ui/ui/Overlay";
import { formatForDisplay } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { Tooltip } from "~/ui/ui/Tooltip";
import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";
import { FileQuestion, Pencil, ShieldAlert, ShieldCheck, Trash2, X } from "lucide-react";
import { useMemo } from "react";

import { useEditorAudioPreview } from "~/audio-authoring/ui/useEditorAudioPreview";
import { useEditorAudioResourceEditController } from "~/audio-authoring/ui/useEditorAudioResourceEditController";
import { useEditorAudioResourceDeleteController } from "~/audio-authoring/ui/useEditorAudioResourceDeleteController";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { EditorFormSectionPage } from "~/editor-control/ui/EditorFormSectionPage";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import type { Project } from "~/project-authoring/type/Project";
import { SfxEventPresentation } from "~/sfx-authoring/constant/SfxEventPresentation";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { sectionLinkClassName } from "~/ui/constant/SectionLinkClassName";
import { Button, DangerButton, PrimaryButtonLink } from "~/ui/ui/Button";
import { LinkButton, LinkButtonLink } from "~/ui/ui/LinkButton";
import { Status } from "~/ui/ui/Status";
import { Fact, FactList } from "~/ui/ui/FactList";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";

interface EditorAudioResourceDetailProps {
	readonly resourceId: string;
	readonly type: "music" | "sfx";
	readonly section: "view" | "edit" | "delete";
}

const AudioDetailSections = [
	{
		id: "view",
		label: "View",
		shortcut: "v",
	},
	{
		id: "delete",
		label: "Delete",
		shortcut: "d",
	},
] as const;

const EditorAudioPreview = ({
	resource,
	type,
}: {
	readonly resource: Project.Resource;
	readonly type: "music" | "sfx";
}) => {
	const resourceIds = useMemo(
		() => [
			resource.id,
		],
		[
			resource.id,
		],
	);
	const preview = useEditorAudioPreview({
		resourceIds,
		type,
	});
	return (
		<EditorAudioPreviewPlayer
			error={preview.playbackError}
			progress={preview.playbackProgress}
			playing={preview.playing}
			seekFn={(progress) => preview.seekPlaybackFn(resource.id, progress)}
			toggleFn={() => preview.togglePlaybackFn(resource.id)}
		/>
	);
};

const EditorAudioResourceUsage = ({
	resourceId,
	asFact = false,
}: {
	readonly resourceId: string;
	readonly asFact?: boolean;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const usages = readGameResourceUsagesFn(project.config).filter(
		(usage) => usage.resourceId === resourceId,
	);
	const usageLabels = usages.map((usage) =>
		usage.owner === "item"
			? usage.ownerLabel
			: usage.resourceType === "sfx"
				? translator.textFn(
						SfxEventPresentation.find(({ event }) => event === usage.roleLabel)
							?.label ?? usage.roleLabel,
					)
				: translator.textFn("Playlist"),
	);
	if (asFact)
		return (
			<Fact
				label={translator.textFn("Usage")}
				value={
					usageLabels.length === 0 ? translator.textFn("Unused") : usageLabels.join(", ")
				}
			/>
		);
	return (
		<section
			data-ui="EditorAudioResourceUsage"
			className="grid gap-3"
		>
			<EditorFormSectionDivider title={translator.textFn("Usage")} />
			{usages.length === 0 ? (
				<p className="text-sm text-muted">
					<Tx label="Unused" />
				</p>
			) : (
				<ul className="ak-list grid">
					{usages.map((usage, index) => (
						<li
							className="ak-list-row p-3 text-sm"
							key={usage.path.join(".")}
						>
							{usageLabels[index]}
						</li>
					))}
				</ul>
			)}
		</section>
	);
};

const EditorAudioResourceEdit = ({
	resource,
	type,
}: {
	readonly resource: Project.Resource;
	readonly type: "music" | "sfx";
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const controller = useEditorAudioResourceEditController({
		resource,
		type,
	});
	return (
		<EditorFormSectionPage
			discardFn={controller.discardFn}
			error={controller.error}
			saveEnabled={controller.dirty}
			saveFn={controller.saveFn}
			saving={controller.saving}
			title={<h1 className="truncate text-xl font-semibold">{resource.name}</h1>}
			leading={
				<EditorHistoryBackButton
					to={
						type === "music"
							? "/editor/$projectId/music/$resourceId/$sectionId"
							: "/editor/$projectId/sfx/$resourceId/$sectionId"
					}
					params={{
						projectId: project.projectId,
						resourceId: resource.id,
						sectionId: "view",
					}}
				/>
			}
		>
			<section
				data-ui="EditorAudioResourceEdit"
				className="grid w-full max-w-3xl gap-6"
			>
				<EditorTextControl
					label={translator.textFn("Name")}
					value={controller.name}
					onChangeFn={controller.setNameFn}
					error={controller.nameError}
				/>
			</section>
		</EditorFormSectionPage>
	);
};

const EditorAudioResourceDelete = ({
	resource,
	type,
}: {
	readonly resource: Project.Resource;
	readonly type: "music" | "sfx";
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const assigned = readGameResourceUsagesFn(project.config).some(
		(usage) => usage.resourceId === resource.id,
	);
	const controller = useEditorAudioResourceDeleteController({
		resourceId: resource.id,
		type,
	});
	return (
		<section
			data-ui="EditorAudioResourceDelete"
			className="grid gap-6"
		>
			<EditorFormSectionDivider title={translator.textFn("Delete audio")} />
			<Status
				dataUi="EditorAudioDeleteState"
				size="large"
				variant="flat"
				icon={assigned ? ShieldAlert : ShieldCheck}
				title={translator.textFn(
					assigned ? "This audio is still in use" : "This audio can be deleted",
				)}
				description={translator.textFn(
					assigned
						? "Deleting this audio also removes the assignments listed below."
						: "This audio is unused. Deleting it removes its file and metadata.",
				)}
				action={
					<DangerButton
						data-ui="EditorAudioDeleteOpen"
						onClick={controller.openFn}
					>
						{translator.textFn(assigned ? "Force delete…" : "Delete")}
					</DangerButton>
				}
			/>
			{assigned ? <EditorAudioResourceUsage resourceId={resource.id} /> : null}
			{controller.confirming ? (
				<Overlay onCloseFn={controller.cancelFn}>
					<div
						data-ui="EditorAudioDeleteDialog"
						className="grid w-full max-w-2xl gap-4 rounded-2xl border border-line-strong bg-modal p-6 text-foreground shadow-2xl"
					>
						<h2 className="text-lg font-semibold">
							{translator.textFn(assigned ? "Force delete audio?" : "Delete audio?")}
						</h2>
						<p className="text-sm leading-6 text-muted">
							<Tx label="Delete" />{" "}
							<strong className="text-foreground">{resource.name}</strong>
						</p>
						{assigned ? (
							<div className="max-h-52 overflow-y-auto overscroll-contain">
								<EditorAudioResourceUsage resourceId={resource.id} />
							</div>
						) : null}
						<p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm leading-6 text-danger">
							<Tx label="Deleting audio removes its file, metadata and assignments. This cannot be undone." />
						</p>
						{controller.error === undefined ? null : (
							<p className="text-sm text-danger">
								{controller.error instanceof Error
									? controller.error.message
									: String(controller.error)}
							</p>
						)}
						<div className="mt-2 flex items-center justify-between gap-4">
							<LinkButton
								className="inline-flex items-center gap-1.5"
								disabled={controller.deleting}
								onClick={controller.cancelFn}
							>
								<X className="size-4" />
								<Tx label="Cancel" />
							</LinkButton>
							<Button
								className="gap-1.5"
								disabled={controller.deleting}
								data-ui="EditorAudioDeleteConfirm"
								cursorIntent={controller.deleting ? "progress" : undefined}
								onClick={() => void controller.confirmFn()}
							>
								<Trash2 className="size-4" />
								{translator.textFn(assigned ? "Force delete" : "Delete")}
							</Button>
						</div>
					</div>
				</Overlay>
			) : null}
		</section>
	);
};

/** Shared Music/SFX detail keeps stable identity visible and metadata editing separate from audio playback. */
export const EditorAudioResourceDetail = ({
	resourceId,
	type,
	section,
}: EditorAudioResourceDetailProps) => {
	const project = useEditorProject();
	const resource = project.resources.find(
		(candidate) => candidate.id === resourceId && candidate.type === type,
	);
	const translator = useTranslator();
	const editRef = useEditorEditShortcut();
	const to =
		type === "music"
			? "/editor/$projectId/music/$resourceId/$sectionId"
			: "/editor/$projectId/sfx/$resourceId/$sectionId";
	const navigateFn = useNavigate();
	useSectionShortcuts({
		enabled: resource !== undefined && section !== "edit",
		options: AudioDetailSections,
		onSelectFn: (tab) => {
			void navigateFn({
				to,
				params: {
					projectId: project.projectId,
					resourceId,
					sectionId: tab.id,
				},
			});
		},
	});
	if (resource !== undefined && section === "edit")
		return (
			<EditorAudioResourceEdit
				key={`${project.projectId}:${type}:${resource.id}`}
				resource={resource}
				type={type}
			/>
		);
	return (
		<EditorSectionPage
			contentClassName="mx-auto w-3/4"
			header={
				<EditorSectionNavigation
					leading={
						<EditorHistoryBackButton
							to={
								type === "music"
									? "/editor/$projectId/music"
									: "/editor/$projectId/sfx"
							}
							params={{
								projectId: project.projectId,
							}}
						/>
					}
					title={
						<h1
							className="truncate text-xl font-semibold"
							data-ui="EditorAudioResourceIdentity"
						>
							{resource?.name ?? resourceId}
						</h1>
					}
					action={
						resource === undefined ? undefined : (
							<PrimaryButtonLink
								ref={editRef}
								to={to}
								params={{
									projectId: project.projectId,
									resourceId,
									sectionId: "edit",
								}}
								className="h-10 min-h-10 gap-2 px-3 py-2 text-sm"
							>
								<Pencil className="size-4" />
								<Tx label="Edit" />
							</PrimaryButtonLink>
						)
					}
				/>
			}
			secondaryNavigation={
				resource === undefined ? undefined : (
					<EditorSectionBar
						actions={
							<EditorAudioPreview
								key={`${project.projectId}:${type}:${resource.id}`}
								resource={resource}
								type={type}
							/>
						}
					>
						{AudioDetailSections.map((tab) => (
							<Tooltip
								key={tab.id}
								content={`${translator.textFn(tab.label)} · ${formatForDisplay({
									key: tab.shortcut,
								})}`}
								placement="bottom"
							>
								<LinkButtonLink
									to={to}
									params={{
										projectId: project.projectId,
										resourceId,
										sectionId: tab.id,
									}}
									className={sectionLinkClassName}
									activeProps={{
										"data-ui-selected": true,
									}}
									inactiveProps={{
										"data-ui-selected": false,
									}}
								>
									<ShortcutLabel
										label={translator.textFn(tab.label)}
										shortcut={tab.shortcut}
									/>
								</LinkButtonLink>
							</Tooltip>
						))}
					</EditorSectionBar>
				)
			}
		>
			{resource === undefined ? (
				<Status
					dataUi="EditorAudioResourceNotFound"
					icon={FileQuestion}
					title={translator.textFn("Audio not found")}
				/>
			) : section === "delete" ? (
				<EditorAudioResourceDelete
					key={`${project.projectId}:${type}:${resource.id}`}
					resource={resource}
					type={type}
				/>
			) : (
				<div
					data-ui="EditorAudioResourceView"
					className="grid min-w-0 gap-[var(--ak-viewport-gap)]"
				>
					<EditorFormSectionDivider
						title={translator.textFn(
							type === "music" ? "Music details" : "SFX details",
						)}
					/>
					<div className="grid grid-cols-2 items-start gap-[var(--ak-viewport-gap)]">
						<section
							className="grid min-w-0 gap-3"
							data-ui="EditorAudioResourceMetadata"
						>
							<EditorFormSectionDivider
								title={translator.textFn(type === "music" ? "Music" : "SFX")}
								action={
									<LinkButtonLink
										className="inline-flex items-center gap-1.5"
										to={to}
										params={{
											projectId: project.projectId,
											resourceId,
											sectionId: "edit",
										}}
									>
										<Pencil className="size-4" />
										<Tx label="Edit" />
									</LinkButtonLink>
								}
							/>
							<EditorRootCard dataUi="EditorAudioResourceMetadataCard">
								<FactList>
									<Fact
										label={translator.textFn("Name")}
										value={resource.name}
									/>
									<Fact
										label={translator.textFn("Size")}
										value={formatByteSizeFn(resource.size)}
									/>
									<Fact
										label="ID"
										mono
										value={resource.id}
									/>
									<EditorAudioResourceUsage
										resourceId={resourceId}
										asFact
									/>
								</FactList>
							</EditorRootCard>
						</section>
					</div>
				</div>
			)}
		</EditorSectionPage>
	);
};
