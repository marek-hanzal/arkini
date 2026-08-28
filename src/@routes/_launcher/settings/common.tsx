import { createFileRoute } from "@tanstack/react-router";

import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import type { WindowMode } from "~/bridge/window/WindowMode";
import { useModelContext } from "~/ui/settings/ModelContext";
import { SettingsSegmentedChoice } from "~/ui/settings/SettingsSegmentedChoice";

const ThemeOptions: ReadonlyArray<{
	readonly value: AppearanceTheme;
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
	readonly value: WindowMode;
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
					<SettingsSegmentedChoice
						options={WindowModeOptions}
						selected={model.windowMode}
						pending={model.blocked}
						name="window-mode"
						ariaLabel="Window mode"
						dataUi="SettingsWindowModeOptions"
						onChange={model.selectWindowMode}
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
					<SettingsSegmentedChoice
						options={ThemeOptions}
						selected={model.theme}
						pending={model.blocked}
						name="appearance-theme"
						ariaLabel="Theme"
						dataUi="SettingsThemeOptions"
						onChange={model.selectTheme}
					/>
					<p className="text-sm leading-6 text-muted">
						System follows the operating-system appearance. Light and Dark override it.
					</p>
				</fieldset>
			</section>
		);
	},
});
