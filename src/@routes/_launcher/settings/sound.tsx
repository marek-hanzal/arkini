import { createFileRoute } from "@tanstack/react-router";

import { SoundLevelControl } from "~/application-settings/ui/SoundLevelControl";
import { useModelContext } from "~/application-settings/ui/ModelContext";

export const Route = createFileRoute("/_launcher/settings/sound")({
	component: () => {
		const model = useModelContext();
		return (
			<fieldset
				className="ak-list grid gap-2"
				data-ui="SettingsSound"
				disabled={model.blocked}
			>
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
		);
	},
});
