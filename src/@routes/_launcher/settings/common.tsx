import { createFileRoute } from "@tanstack/react-router";

import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import { useModelContext } from "~/application-settings/ui/ModelContext";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";

const WindowModeOptions: ReadonlyArray<{
	readonly value: WindowModeSchema.Type;
	readonly label: string;
}> = [
	{
		value: "default",
		label: "Default",
	},
	{
		value: "bordered",
		label: "Bordered",
	},
	{
		value: "fullscreen",
		label: "Fullscreen",
	},
];

export const Route = createFileRoute("/_launcher/settings/common")({
	component: () => {
		const model = useModelContext();
		return (
			<section
				className="grid gap-5"
				data-ui="SettingsCommon"
			>
				<fieldset
					className="grid gap-3"
					disabled={model.blocked}
				>
					<EditorFormSectionDivider title="Window" />
					<SegmentedControl
						options={WindowModeOptions}
						value={model.windowMode}
						pending={model.blocked}
						fill
						dataUi="SettingsWindowModeOptions"
						optionDataUi="SettingsSegmentedChoiceOption"
						onChangeFn={model.selectWindowModeFn}
					/>
					<p className="text-sm leading-6 text-muted">
						Default uses the standard window size. Bordered fills the screen with its
						title bar. Fullscreen uses the native fullscreen space.
					</p>
				</fieldset>
			</section>
		);
	},
});
