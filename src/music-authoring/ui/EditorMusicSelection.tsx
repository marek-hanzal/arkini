import { useMemo } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorAudioPreview } from "~/audio-authoring/ui/useEditorAudioPreview";
import { EditorAudioPreviewPlayer } from "~/audio-authoring/ui/EditorAudioPreviewPlayer";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
import { LinkButton, LinkButtonLink } from "~/ui/ui/LinkButton";
import { Fact, FactList } from "~/ui/ui/FactList";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";

/** Selects an item-detail track with one shared preview session for options and the selected track. */
export const EditorMusicSelection = ({
	resourceId,
	onChangeFn,
	error,
}: {
	readonly resourceId?: string;
	readonly onChangeFn?: (resourceId: string | undefined) => void;
	readonly error?: string;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const music = useMemo(
		() => project.resources.filter((resource) => resource.type === "music"),
		[
			project.resources,
		],
	);
	const resourceIds = useMemo(
		() => music.map(({ id }) => id),
		[
			music,
		],
	);
	const options = useMemo(
		() =>
			music.map((resource) => ({
				id: resource.id,
				label: resource.name ?? resource.id,
				terms: [
					resource.name ?? resource.id,
					resource.id,
				],
			})),
		[
			music,
		],
	);
	const preview = useEditorAudioPreview({
		resourceIds,
		type: "music",
	});
	const selected = music.find(({ id }) => id === resourceId);
	const selectedActive = preview.activeResourceId === resourceId;
	return (
		<div
			className="grid gap-4"
			data-ui="EditorMusicSelection"
		>
			{onChangeFn === undefined ? (
				<FactList columns={1}>
					<Fact
						label={translator.textFn("Music")}
						labelSuffix={
							<EditorInfoTooltip content={<Mx label="Item detail music help" />} />
						}
						value={
							selected === undefined ? (
								translator.textFn("Global playlist")
							) : (
								<LinkButtonLink
									to="/editor/$projectId/music/$resourceId/$sectionId"
									params={{
										projectId: project.projectId,
										resourceId: selected.id,
										sectionId: "view",
									}}
								>
									{selected.name ?? selected.id}
								</LinkButtonLink>
							)
						}
					/>
				</FactList>
			) : (
				<div className="flex items-end gap-2">
					<div className="min-w-0 flex-1">
						<EditorSearchCombobox
							label={translator.textFn("Music")}
							description={<Mx label="Item detail music help" />}
							placeholder={translator.textFn("Global playlist")}
							emptyLabel={translator.textFn("No matching music")}
							displaySelectedLabel
							value={resourceId ?? ""}
							options={options}
							error={error}
							onChangeFn={(id) => onChangeFn(id || undefined)}
							renderPreviewFn={() => null}
							renderOptionContentFn={(option) => (
								<span className="flex min-w-0 flex-1 items-center gap-3">
									<span className="min-w-0 flex-1 truncate text-sm font-semibold">
										{option.label}
									</span>
									<span
										className="grid size-8 shrink-0 place-items-center text-foreground"
										data-ui="EditorMusicOptionPlayback"
										onClick={(event) => {
											event.stopPropagation();
											preview.togglePlaybackFn(option.id);
										}}
									>
										{preview.activeResourceId === option.id &&
										preview.playing ? (
											<Pause className="size-4" />
										) : (
											<Play className="size-4" />
										)}
									</span>
								</span>
							)}
						/>
					</div>
					{resourceId === undefined ? null : (
						<LinkButton
							className="grid size-10 shrink-0 place-items-center"
							title={translator.textFn("Clear")}
							onClick={() => onChangeFn(undefined)}
						>
							<Trash2 className="size-4" />
						</LinkButton>
					)}
				</div>
			)}
			<EditorAudioPreviewPlayer
				fill
				disabled={selected === undefined}
				error={preview.playbackError}
				progress={selected !== undefined && selectedActive ? preview.playbackProgress : 0}
				playing={selected !== undefined && selectedActive && preview.playing}
				seekFn={(progress) => {
					if (selected !== undefined) preview.seekPlaybackFn(selected.id, progress);
				}}
				toggleFn={() => {
					if (selected !== undefined) preview.togglePlaybackFn(selected.id);
				}}
			/>
		</div>
	);
};
