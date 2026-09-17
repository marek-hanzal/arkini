import { Overlay } from "~/ui/ui/Overlay";
import { formatForDisplay } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { Tooltip } from "~/ui/ui/Tooltip";
import { useEditorSectionShortcuts } from "~/authoring-shell/ui/useEditorSectionShortcuts";
import { AudioLines, FileQuestion, Music2, Pause, Pencil, Play } from "lucide-react";
import { useMemo } from "react";

import { useEditorAudioPreview } from "~/audio-authoring/ui/useEditorAudioPreview";
import { useEditorAudioResourceEditController } from "~/audio-authoring/ui/useEditorAudioResourceEditController";
import { useEditorAudioResourceDeleteController } from "~/audio-authoring/ui/useEditorAudioResourceDeleteController";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import {
	EditorSectionBar,
	editorSectionLinkClassName,
} from "~/authoring-shell/ui/EditorSectionBar";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { EditorFormSectionPage } from "~/editor-control/ui/EditorFormSectionPage";
import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import type { Project } from "~/project-authoring/type/Project";
import { useProjectNotes } from "~/project-note/ui/useProjectNotes";
import { SfxEventPresentation } from "~/sfx-authoring/constant/SfxEventPresentation";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { Button, DangerButton, PrimaryButtonLink } from "~/ui/ui/Button";
import { LinkButton, LinkButtonLink } from "~/ui/ui/LinkButton";
import { Status } from "~/ui/ui/Status";

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
	const translator = useTranslator();
	return (
		<section
			data-ui="EditorAudioPreview"
			className="grid gap-3 rounded-xl border border-line p-4"
		>
			<div className="flex items-center gap-3">
				<LinkButton
					className="grid size-10 shrink-0 place-items-center text-foreground"
					title={translator.textFn(preview.playing ? "Pause" : "Play")}
					data-ui="EditorAudioPreviewToggle"
					onClick={() => preview.togglePlaybackFn(resource.id)}
				>
					{preview.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
				</LinkButton>
				<input
					className="min-w-0 flex-1"
					type="range"
					min={0}
					max={1}
					step={0.001}
					value={preview.playbackProgress}
					onChange={(event) =>
						preview.seekPlaybackFn(resource.id, event.currentTarget.valueAsNumber)
					}
				/>
				<label className="flex items-center gap-2 text-sm">
					<Tx label="Volume" />
					<input
						className="w-16 rounded border border-control-border bg-surface p-2"
						type="number"
						min={0}
						max={100}
						value={preview.volume}
						onChange={(event) =>
							preview.setVolumeFn(event.currentTarget.valueAsNumber || 0)
						}
					/>
				</label>
			</div>
			<p className="text-sm text-muted">
				{translator.textFn(type === "music" ? "Music" : "SFX")} ·{" "}
				{formatByteSizeFn(resource.size)}
			</p>
			{preview.playbackError === undefined ? null : (
				<p className="text-sm text-danger">{preview.playbackError}</p>
			)}
		</section>
	);
};

const EditorAudioResourceUsage = ({ resourceId }: { readonly resourceId: string }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const notes = useProjectNotes(project.projectId);
	const usages = readGameResourceUsagesFn(project.config).filter(
		(usage) => usage.resourceId === resourceId,
	);
	const linkedNotes = notes.notes.filter((note) => note.resourceIds.includes(resourceId));
	return (
		<section
			data-ui="EditorAudioResourceUsage"
			className="grid gap-3"
		>
			<h2 className="text-lg font-semibold">
				<Tx label="Usage" />
			</h2>
			{usages.length === 0 ? (
				<p className="text-sm text-muted">
					<Tx label="Unused" />
				</p>
			) : (
				<ul className="grid gap-2">
					{usages.map((usage) => (
						<li
							className="rounded-lg border border-line p-3 text-sm"
							key={usage.path.join(".")}
						>
							{usage.resourceType === "sfx"
								? translator.textFn(
										SfxEventPresentation.find(
											({ event }) => event === usage.roleLabel,
										)?.label ?? usage.roleLabel,
									)
								: translator.textFn("Playlist")}
						</li>
					))}
				</ul>
			)}
			<p className="text-sm text-muted">
				{notes.loaded
					? `${translator.textFn("Notes")}: ${linkedNotes.length}`
					: translator.textFn("Loading…")}
			</p>
			{notes.error === undefined ? null : (
				<p className="text-sm text-danger">{String(notes.error)}</p>
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
				className="grid gap-4"
			>
				<p className="text-sm text-muted">ID: {resource.id}</p>
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
	const controller = useEditorAudioResourceDeleteController({
		resourceId: resource.id,
		type,
	});
	return (
		<section
			data-ui="EditorAudioResourceDelete"
			className="grid gap-6"
		>
			<EditorAudioResourceUsage resourceId={resource.id} />
			<p className="text-sm text-muted">
				<Tx label="Deleting audio removes the file, its metadata, assignments and Notes links. This cannot be undone." />
			</p>
			<div>
				<DangerButton
					data-ui="EditorAudioDeleteOpen"
					onClick={controller.openFn}
				>
					<Tx label="Delete" />
				</DangerButton>
			</div>
			{controller.confirming ? (
				<Overlay onCloseFn={controller.cancelFn}>
					<div
						data-ui="EditorAudioDeleteDialog"
						className="grid w-full max-w-md gap-4 rounded-2xl border border-line-strong bg-surface-raised p-6 shadow-2xl"
					>
						<h2 className="text-lg font-semibold">
							<Tx label="Delete" /> {resource.name}?
						</h2>
						<p className="text-sm text-muted">
							<Tx label="Deleting audio removes the file, its metadata, assignments and Notes links. This cannot be undone." />
						</p>
						{controller.error === undefined ? null : (
							<p className="text-sm text-danger">
								{controller.error instanceof Error
									? controller.error.message
									: String(controller.error)}
							</p>
						)}
						<div className="flex justify-end gap-2">
							<Button
								disabled={controller.deleting}
								onClick={controller.cancelFn}
							>
								<Tx label="Cancel" />
							</Button>
							<DangerButton
								disabled={controller.deleting}
								data-ui="EditorAudioDeleteConfirm"
								cursorIntent={controller.deleting ? "progress" : undefined}
								onClick={() => void controller.confirmFn()}
							>
								<Tx label="Delete" />
							</DangerButton>
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
	const Icon = type === "music" ? Music2 : AudioLines;
	const to =
		type === "music"
			? "/editor/$projectId/music/$resourceId/$sectionId"
			: "/editor/$projectId/sfx/$resourceId/$sectionId";
	const navigateFn = useNavigate();
	useEditorSectionShortcuts({
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
						<h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold">
							<Icon className="size-6 shrink-0" />
							<span className="truncate">{resource?.name ?? resourceId}</span>
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
					<EditorSectionBar>
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
									className={editorSectionLinkClassName}
									activeProps={{
										"data-ui-selected": true,
									}}
									inactiveProps={{
										"data-ui-selected": false,
									}}
								>
									<Tx label={tab.label} />
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
					className="grid max-w-3xl gap-6"
				>
					<p className="text-sm text-muted">ID: {resource.id}</p>
					<EditorAudioPreview
						key={`${project.projectId}:${type}:${resource.id}`}
						resource={resource}
						type={type}
					/>
					<EditorAudioResourceUsage resourceId={resourceId} />
				</div>
			)}
		</EditorSectionPage>
	);
};
