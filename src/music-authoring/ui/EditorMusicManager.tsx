import { ListMusic, LoaderCircle, Music2, Pause, Play, Plus, Trash2 } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { readResourceNameFn } from "~/game-config-resource/fn/readResourceNameFn";
import { useEditorMusicManagerController } from "~/music-authoring/ui/useEditorMusicManagerController";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { SearchInput } from "~/ui/ui/SearchInput";
import { Status } from "~/ui/ui/Status";
import { Tooltip } from "~/ui/ui/Tooltip";

/** Renders the project Music list, direct preview controls and reserved mini-player bar. */
export const EditorMusicManager = () => {
	const project = useEditorProject();
	const translator = useTranslator();
	const controller = useEditorMusicManagerController();
	const error =
		controller.importError ??
		controller.deleteError ??
		controller.playlistError ??
		controller.playbackError;
	const errorMessage =
		error === undefined ? undefined : error instanceof Error ? error.message : String(error);
	const importButton = (
		<PrimaryButton
			className="h-10 min-h-10 gap-2 px-3 py-2 text-sm"
			cursorIntent={controller.importPending ? "progress" : undefined}
			disabled={controller.importPending}
			data-ui="EditorMusicImport"
			onClick={controller.openFilesImportFn}
		>
			{controller.importPending ? (
				<LoaderCircle className="size-4 animate-spin" />
			) : (
				<Plus className="size-4" />
			)}
			{controller.importPending
				? translator.textFn("Importing music…")
				: translator.textFn("Import music")}
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
						data-ui="EditorMusicSearch"
						placeholder={`${translator.textFn("Search music…")} (${controller.totalMusicCount})`}
						onValueChangeFn={controller.setQueryFn}
					/>
					<label className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 text-sm text-muted">
						{translator.textFn("Volume")}
						<input
							type="number"
							className="w-16 bg-transparent text-right text-foreground outline-none"
							data-ui="EditorMusicVolume"
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
					help={
						<EditorPageHelp
							content={<Mx label="Music help" />}
							title={translator.textFn("Music")}
						/>
					}
				/>
			}
		>
			<div
				className="h-full min-h-0"
				data-ui="EditorMusicManager"
			>
				<input
					ref={controller.filesInputRef}
					className="hidden"
					type="file"
					accept="audio/*,.aac,.flac,.m4a,.mp3,.ogg,.opus,.wav,.webm"
					multiple
					data-ui="EditorMusicImportInput"
					disabled={controller.importPending}
					onChange={controller.onFilesChangeFn}
				/>
				<div className="min-h-0 overflow-y-auto overscroll-contain p-3">
					{errorMessage === undefined ? null : (
						<p
							className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
							data-ui="EditorMusicError"
						>
							{errorMessage}
						</p>
					)}
					{controller.music.length === 0 ? (
						<Status
							action={importButton}
							dataUi="EditorMusicEmpty"
							description={translator.textFn(
								controller.totalMusicCount === 0
									? "Import audio files to create the project music library."
									: "No music matches this search.",
							)}
							icon={Music2}
							size="large"
							title={translator.textFn(
								controller.totalMusicCount === 0
									? "No music yet"
									: "No matching music",
							)}
							variant="flat"
						/>
					) : (
						<ul
							className="ak-list grid gap-2"
							data-ui="EditorMusicList"
						>
							{controller.music.map((resource) => {
								const active = controller.activeResourceId === resource.id;
								const inPlaylist = controller.playlistResourceIds.has(resource.id);
								const playing = active && controller.playing;
								const deleting =
									controller.deletePending &&
									controller.deletingResourceId === resource.id;
								const togglingPlaylist =
									controller.playlistPending &&
									controller.togglingPlaylistResourceId === resource.id;
								return (
									<li
										className="ak-list-row ak-list-row-interactive grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-3 overflow-hidden rounded-xl px-4 py-3"
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
											dataUi: "EditorMusicRow",
											state: {
												deleting,
												playing,
												state: active ? "active" : undefined,
											},
										})}
									>
										{active ? (
											<div
												className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-[var(--ak-list-row-active-progress-surface)] transition-[width] duration-200 ease-linear"
												data-ui="EditorMusicProgress"
												style={{
													width: `${controller.playbackProgress * 100}%`,
												}}
											/>
										) : null}
										<div className="relative z-10 grid size-10 shrink-0 place-items-center rounded-lg bg-surface-raised text-accent">
											<Music2 className="size-5" />
										</div>
										<div className="relative z-10 min-w-0">
											<p className="truncate font-semibold">
												{readResourceNameFn(resource.id)}
											</p>
											<p className="truncate text-xs text-muted">
												{formatByteSizeFn(resource.size)}
											</p>
										</div>
										<Tooltip
											content={translator.textFn(
												inPlaylist
													? "Remove from playlist"
													: "Add to playlist",
											)}
											placement="left"
										>
											<Button
												className="relative z-10 size-10 min-h-10 shrink-0 p-0 data-[ui-selected=true]:border-accent/40 data-[ui-selected=true]:bg-accent/15 data-[ui-selected=true]:text-accent"
												cursorIntent={
													togglingPlaylist ? "progress" : undefined
												}
												disabled={
													controller.playlistPending ||
													controller.deletePending
												}
												onClick={(event) => {
													event.stopPropagation();
													controller.togglePlaylistFn(resource.id);
												}}
												{...readDataUiFn({
													dataUi: "EditorMusicPlaylist",
													state: {
														pending: togglingPlaylist,
														selected: inPlaylist,
													},
												})}
											>
												{togglingPlaylist ? (
													<LoaderCircle className="size-4 animate-spin" />
												) : (
													<ListMusic className="size-4" />
												)}
											</Button>
										</Tooltip>
										<Tooltip
											content={translator.textFn(playing ? "Pause" : "Play")}
											placement="left"
										>
											<Button
												className="relative z-10 size-10 min-h-10 shrink-0 p-0"
												data-ui="EditorMusicPlayback"
												disabled={controller.deletePending}
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
										<Tooltip
											content={translator.textFn("Delete")}
											placement="left"
										>
											<Button
												className="relative z-10 size-10 min-h-10 shrink-0 p-0 text-danger"
												cursorIntent={deleting ? "progress" : undefined}
												data-ui="EditorMusicDelete"
												disabled={controller.deletePending}
												onClick={(event) => {
													event.stopPropagation();
													controller.deleteMusicFn(resource.id);
												}}
											>
												{deleting ? (
													<LoaderCircle className="size-4 animate-spin" />
												) : (
													<Trash2 className="size-4" />
												)}
											</Button>
										</Tooltip>
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
