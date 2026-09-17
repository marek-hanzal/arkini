import type { ReactNode } from "react";
import { AudioLines, LoaderCircle, Music2, Pause, Play, Plus } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import type { useEditorAudioResourceManagerController } from "~/audio-authoring/ui/useEditorAudioResourceManagerController";
import { Link } from "@tanstack/react-router";
import type { Project } from "~/project-authoring/type/Project";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { SearchInput } from "~/ui/ui/SearchInput";
import { Status } from "~/ui/ui/Status";
import { Tooltip } from "~/ui/ui/Tooltip";

interface EditorAudioResourceManagerProps {
	readonly controller: useEditorAudioResourceManagerController.Output;
	readonly extraError?: unknown;
	readonly renderResourceActionFn?: (resource: Project.Resource) => ReactNode;
	readonly resourceMutationBlocked?: boolean;
	readonly resources: ReadonlyArray<Project.Resource>;
	readonly secondaryActions?: ReactNode;
	readonly secondaryNavigation: ReactNode;
}

/** Renders the shared Music/SFX library, import controls and lazy preview rows. */
export const EditorAudioResourceManager = ({
	controller,
	extraError,
	renderResourceActionFn,
	resourceMutationBlocked = false,
	resources,
	secondaryActions,
	secondaryNavigation,
}: EditorAudioResourceManagerProps) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const music = controller.type === "music";
	const Icon = music ? Music2 : AudioLines;
	const title = music ? translator.textFn("Music") : translator.textFn("SFX");
	const emptyDescription = music
		? translator.textFn("Import audio files to create the project music library.")
		: translator.textFn("Import audio files to create the project sound effects library.");
	const emptyTitle = music
		? translator.textFn("No music yet")
		: translator.textFn("No sound effects yet");
	const noMatchTitle = music
		? translator.textFn("No matching music")
		: translator.textFn("No matching sound effects");
	const dataUiPrefix = music ? "EditorMusic" : "EditorSfx";
	const error = controller.importError ?? extraError ?? controller.playbackError;
	const errorMessage =
		error === undefined ? undefined : error instanceof Error ? error.message : String(error);
	const importButton = (
		<PrimaryButton
			className="h-10 min-h-10 gap-2 px-3 py-2 text-sm"
			cursorIntent={controller.importPending ? "progress" : undefined}
			disabled={controller.importPending || resourceMutationBlocked}
			data-ui={`${dataUiPrefix}Import`}
			onClick={controller.openFilesImportFn}
		>
			{controller.importPending ? (
				<LoaderCircle className="size-4 animate-spin" />
			) : (
				<Plus className="size-4" />
			)}
			{controller.importPending
				? music
					? translator.textFn("Importing music…")
					: translator.textFn("Importing SFX…")
				: music
					? translator.textFn("Import music")
					: translator.textFn("Import SFX")}
		</PrimaryButton>
	);

	return (
		<EditorSectionPage
			contentMode="viewport"
			header={
				<header className="flex min-w-0 items-center gap-2">
					<EditorHistoryBackButton
						params={{
							projectId: project.projectId,
						}}
						to="/editor/$projectId/editor/items/list"
					/>
					<SearchInput
						value={controller.query}
						containerClassName="min-w-64 flex-1"
						className="h-10 min-h-10 w-full rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 text-sm text-foreground outline-none placeholder:text-muted"
						data-ui={`${dataUiPrefix}Search`}
						placeholder={`${music ? translator.textFn("Search music…") : translator.textFn("Search SFX…")} (${controller.totalResourceCount})`}
						onValueChangeFn={controller.setQueryFn}
					/>
					<label className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 text-sm text-muted">
						{translator.textFn("Volume")}
						<input
							type="number"
							className="w-16 bg-transparent text-right text-foreground outline-none"
							data-ui={`${dataUiPrefix}Volume`}
							min={0}
							max={100}
							value={controller.volume}
							onChange={(event) =>
								controller.setVolumeFn(event.currentTarget.valueAsNumber || 0)
							}
						/>
					</label>
					{importButton}
				</header>
			}
			secondaryNavigation={
				<EditorSectionBar
					actions={secondaryActions}
					help={
						<EditorPageHelp
							content={music ? <Mx label="Music help" /> : <Mx label="SFX help" />}
							title={title}
						/>
					}
				>
					{secondaryNavigation}
				</EditorSectionBar>
			}
		>
			<div
				className="h-full min-h-0"
				data-ui={`${dataUiPrefix}Manager`}
			>
				<input
					ref={controller.filesInputRef}
					className="hidden"
					type="file"
					accept="audio/*,.aac,.flac,.m4a,.mp3,.ogg,.opus,.wav,.webm"
					multiple
					data-ui={`${dataUiPrefix}ImportInput`}
					disabled={controller.importPending || resourceMutationBlocked}
					onChange={controller.onFilesChangeFn}
				/>
				<div
					className="h-full min-h-0 overflow-y-auto overscroll-contain p-3"
					data-ui={`${dataUiPrefix}Scroll`}
				>
					{errorMessage === undefined ? null : (
						<p
							className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
							data-ui={`${dataUiPrefix}Error`}
						>
							{errorMessage}
						</p>
					)}
					{resources.length === 0 ? (
						<Status
							action={importButton}
							dataUi={`${dataUiPrefix}Empty`}
							description={
								controller.totalResourceCount === 0
									? emptyDescription
									: translator.textFn("No audio matches the current filters.")
							}
							icon={Icon}
							size="large"
							title={controller.totalResourceCount === 0 ? emptyTitle : noMatchTitle}
							variant="flat"
						/>
					) : (
						<ul
							className="ak-list grid gap-2"
							data-ui={`${dataUiPrefix}List`}
						>
							{resources.map((resource) => {
								const active = controller.activeResourceId === resource.id;
								const playing = active && controller.playing;

								return (
									<li
										className="ak-list-row ak-list-row-interactive grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-xl px-4 py-3"
										key={resource.id}
										onClick={(event) => {
											const bounds =
												event.currentTarget.getBoundingClientRect();
											controller.seekPlaybackFn(
												resource.id,
												(event.clientX - bounds.left) / bounds.width,
											);
										}}
										{...readDataUiFn({
											dataUi: `${dataUiPrefix}Row`,
											state: {
												playing,
												state: active ? "active" : undefined,
											},
										})}
									>
										{active ? (
											<div
												className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-[var(--ak-list-row-active-progress-surface)] transition-[width] duration-200 ease-linear"
												data-ui={`${dataUiPrefix}Progress`}
												style={{
													width: `${controller.playbackProgress * 100}%`,
												}}
											/>
										) : null}
										<div className="relative z-10 grid size-10 shrink-0 place-items-center rounded-lg bg-surface-raised text-accent">
											<Icon className="size-5" />
										</div>
										<div className="relative z-10 min-w-0">
											<Link
												className="block truncate font-semibold hover:underline"
												data-ui={`${dataUiPrefix}DetailLink`}
												to={
													music
														? "/editor/$projectId/music/$resourceId/$sectionId"
														: "/editor/$projectId/sfx/$resourceId/$sectionId"
												}
												params={{
													projectId: project.projectId,
													resourceId: resource.id,
													sectionId: "view",
												}}
												onClick={(event) => event.stopPropagation()}
											>
												{resource.name}
											</Link>
											<p className="truncate text-xs text-muted">
												{resource.id} · {formatByteSizeFn(resource.size)}
											</p>
										</div>
										<div className="relative z-10 flex items-center gap-3">
											{renderResourceActionFn?.(resource)}
											<Tooltip
												content={translator.textFn(
													playing ? "Pause" : "Play",
												)}
												placement="left"
											>
												<Button
													className="size-10 min-h-10 shrink-0 p-0"
													data-ui={`${dataUiPrefix}Playback`}
													onClick={(event) => {
														event.stopPropagation();
														controller.togglePlaybackFn(resource.id);
													}}
												>
													{playing ? (
														<Pause className="size-4" />
													) : (
														<Play className="size-4" />
													)}
												</Button>
											</Tooltip>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			</div>
		</EditorSectionPage>
	);
};
