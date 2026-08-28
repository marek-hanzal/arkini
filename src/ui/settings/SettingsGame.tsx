import { useSettingsModelContext } from "~/ui/settings/SettingsModelContext";

export const SettingsGame = () => {
	const model = useSettingsModelContext();
	return (
		<section data-ui="SettingsGame">
			<label
				className={`ak-list-row ak-list-row-interactive flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line px-4 py-3 ${model.blocked ? "ak-list-row-pending cursor-progress" : ""}`}
				data-ui="SettingsCheatAvailability"
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
					onChange={(event) => model.setCheatToolsAvailable(event.currentTarget.checked)}
				/>
			</label>
		</section>
	);
};
