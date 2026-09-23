import { ListMusic, LoaderCircle } from "lucide-react";

import { EditorAudioResourceManager } from "~/audio-authoring/ui/EditorAudioResourceManager";
import { EditorSectionShortcutNavigation } from "~/authoring-shell/ui/EditorSectionBar";
import { useEditorMusicManagerController } from "~/music-authoring/ui/useEditorMusicManagerController";
import type { Project } from "~/project-authoring/type/Project";
import { useTranslator } from "~/translation/ui/useTranslator";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Tooltip } from "~/ui/ui/Tooltip";

/** Renders Music-specific playlist selection over the shared audio library. */
export const EditorMusicManager = () => {
	const translator = useTranslator();
	const controller = useEditorMusicManagerController();
	const viewOptions = [
		{
			label: translator.textFn("All"),
			value: "all",
			shortcut: "a",
		},
		{
			label: translator.textFn("Playlist"),
			value: "playlist",
			shortcut: "p",
		},
		{
			label: translator.textFn("Unused"),
			value: "unused",
			shortcut: "u",
		},
	] as const satisfies ReadonlyArray<{
		readonly label: string;
		readonly shortcut: string;
		readonly value: useEditorMusicManagerController.View;
	}>;
	const renderResourceActionFn = (resource: Project.Resource) => {
		const inPlaylist = controller.playlistResourceUids.has(resource.uid);
		const togglingPlaylist =
			controller.playlistPending && controller.togglingPlaylistResourceUid === resource.uid;
		return (
			<Tooltip
				content={translator.textFn(inPlaylist ? "Remove from playlist" : "Add to playlist")}
				placement="left"
			>
				<LinkButton
					className="grid size-10 shrink-0 place-items-center text-muted hover:text-muted data-[ui-selected=true]:text-accent data-[ui-selected=true]:hover:text-accent"
					cursorIntent={togglingPlaylist ? "progress" : undefined}
					disabled={controller.playlistPending}
					onClick={(event) => {
						event.stopPropagation();
						controller.togglePlaylistFn(resource.uid);
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
				</LinkButton>
			</Tooltip>
		);
	};

	return (
		<EditorAudioResourceManager
			controller={controller}
			extraError={controller.playlistError}
			renderResourceActionFn={renderResourceActionFn}
			resources={controller.music}
			secondaryNavigation={
				<EditorSectionShortcutNavigation
					dataUi="EditorMusicView"
					onChangeFn={controller.setViewFn}
					options={viewOptions}
					value={controller.view}
				/>
			}
		/>
	);
};
