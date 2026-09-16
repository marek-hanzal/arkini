import { EditorAudioResourceManager } from "~/audio-authoring/ui/EditorAudioResourceManager";
import { useEditorAudioResourceManagerController } from "~/audio-authoring/ui/useEditorAudioResourceManagerController";
import { EditorSectionShortcutNavigation } from "~/authoring-shell/ui/EditorSectionBar";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Renders the project SFX library over the shared audio authoring surface. */
export const EditorSfxManager = () => {
	const translator = useTranslator();
	const controller = useEditorAudioResourceManagerController({
		type: "sfx",
	});
	const viewOptions = [
		{
			label: translator.textFn("All"),
			value: "all",
		},
	] as const;

	return (
		<EditorAudioResourceManager
			controller={controller}
			resources={controller.resources}
			secondaryNavigation={
				<EditorSectionShortcutNavigation
					dataUi="EditorSfxView"
					onChangeFn={() => undefined}
					options={viewOptions}
					value="all"
				/>
			}
		/>
	);
};
