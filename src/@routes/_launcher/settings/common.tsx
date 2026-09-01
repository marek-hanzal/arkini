import { createFileRoute } from "@tanstack/react-router";

import type { AppearanceThemeSchema } from "~electron/contract/appearance/AppearanceThemeSchema";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import { useModelContext } from "~/application-settings/ui/ModelContext";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";

const ThemeOptions: ReadonlyArray<{
	readonly value: AppearanceThemeSchema.Type;
	readonly label: string;
}> = [
	{
		value: "system",
		label: "System",
	},
	{
		value: "light",
		label: "Light",
	},
	{
		value: "dark",
		label: "Dark",
	},
];

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
					<legend className="text-sm font-semibold text-foreground">Window</legend>
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

				<fieldset
					className="grid gap-3 border-t border-line pt-5"
					disabled={model.blocked}
				>
					<legend className="text-sm font-semibold text-foreground">Theme</legend>
					<SegmentedControl
						options={ThemeOptions}
						value={model.theme}
						pending={model.blocked}
						fill
						dataUi="SettingsThemeOptions"
						optionDataUi="SettingsSegmentedChoiceOption"
						onChangeFn={model.selectThemeFn}
					/>
					<p className="text-sm leading-6 text-muted">
						System follows the operating-system appearance. Light and Dark override it.
					</p>
				</fieldset>
			</section>
		);
	},
});
