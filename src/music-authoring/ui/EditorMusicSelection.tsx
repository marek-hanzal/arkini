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
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

/** Selects an item-detail track with one shared preview session for options and the selected track. */
export const EditorMusicSelection = ({
	resourceUid,
	onChangeFn,
	error,
}: {
	readonly resourceUid?: string;
	readonly onChangeFn?: (resourceUid: string | undefined) => void;
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
	const resourceUids = useMemo(
		() => music.map(({ uid }) => uid),
		[
			music,
		],
	);
	const options = useMemo(
		() =>
			music.map((resource) => ({
				id: resource.uid,
				label: resource.title ?? resource.uid,
				terms: [
					resource.title ?? resource.uid,
					resource.uid,
				],
			})),
		[
			music,
		],
	);
	const preview = useEditorAudioPreview({
		resourceUids,
		type: "music",
	});
	const selected = music.find(({ uid }) => uid === resourceUid);
	const selectedActive = preview.activeResourceUid === resourceUid;
	return (
		<div
			className="grid gap-4 data-[ui-read-only=true]:gap-1"
			{...readDataUiFn({
				dataUi: "EditorMusicSelection",
				state: {
					readOnly: onChangeFn === undefined,
				},
			})}
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
									to="/editor/$projectId/music/$resourceUid/$sectionId"
									params={{
										projectId: project.projectId,
										resourceUid: selected.uid,
										sectionId: "view",
									}}
								>
									{selected.title ?? selected.uid}
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
							value={resourceUid ?? ""}
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
										{preview.activeResourceUid === option.id &&
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
					{resourceUid === undefined ? null : (
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
				trackName={selected?.title ?? selected?.uid}
				disabled={selected === undefined}
				placeholder={
					selected === undefined
						? translator.textFn("Choose a track to listen to it here.")
						: undefined
				}
				error={preview.playbackError}
				progress={selected !== undefined && selectedActive ? preview.playbackProgress : 0}
				playing={selected !== undefined && selectedActive && preview.playing}
				seekFn={(progress) => {
					if (selected !== undefined) preview.seekPlaybackFn(selected.uid, progress);
				}}
				toggleFn={() => {
					if (selected !== undefined) preview.togglePlaybackFn(selected.uid);
				}}
			/>
		</div>
	);
};
