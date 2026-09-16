import { createFileRoute } from "@tanstack/react-router";

import { useModelContext } from "~/application-settings/ui/ModelContext";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { SoundLevelControl } from "~/application-settings/ui/SoundLevelControl";

export const Route = createFileRoute("/_launcher/settings/game")({
	component: () => {
		const model = useModelContext();
		return (
			<section
				className="grid gap-5"
				data-ui="SettingsGame"
			>
				<fieldset
					className="grid gap-4"
					disabled={model.blocked}
				>
					<legend className="mb-1 text-sm font-semibold text-foreground">Sound</legend>
					<SoundLevelControl
						label="Master"
						value={model.sound.master}
						onChangeFn={(volume) => model.setSoundVolumeFn("master", volume)}
					/>
					<SoundLevelControl
						label="Music"
						value={model.sound.music}
						onChangeFn={(volume) => model.setSoundVolumeFn("music", volume)}
					/>
					<SoundLevelControl
						label="Sound effects"
						value={model.sound.sfx}
						onChangeFn={(volume) => model.setSoundVolumeFn("sfx", volume)}
					/>
				</fieldset>
				<label
					className="ak-list-row ak-list-row-interactive flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line border-t px-4 py-3 data-[ui-pending=true]:cursor-progress"
					{...readDataUiFn({
						dataUi: "SettingsCheatAvailability",
						state: {
							pending: model.blocked,
						},
					})}
				>
					<span className="grid gap-1">
						<span className="text-sm font-semibold text-foreground">Cheat tools</span>
						<span className="text-sm leading-5 text-muted">
							Make the optional Cheats page available in each Game menu. Cheat mode is
							enabled separately for every save.
						</span>
					</span>
					<input
						type="checkbox"
						checked={model.cheatToolsAvailable}
						className="size-5 shrink-0 accent-accent"
						disabled={model.blocked}
						onChange={(event) =>
							model.setCheatToolsAvailableFn(event.currentTarget.checked)
						}
					/>
				</label>
			</section>
		);
	},
});
