import type { Effect } from "effect";
import { match } from "ts-pattern";

import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import type { WindowMode } from "~/bridge/window/WindowMode";
import { BackButton } from "~/ui/button/BackButton";
import { SettingsOpenActionRow } from "~/ui/settings/SettingsOpenActionRow";
import { SettingsSegmentedChoice } from "~/ui/settings/SettingsSegmentedChoice";
import { useSettingsModel } from "~/ui/settings/useSettingsModel";

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

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export namespace Settings {
	export interface Props {
		readonly onBackFx: Effect.Effect<void, unknown>;
	}
}

/** Renders the reusable authoritative application settings content. */
export const Settings = ({ onBackFx }: Settings.Props) => {
	const model = useSettingsModel({
		onBackFx,
	});

	return (
		<section
			className="grid gap-5"
			data-ui="Settings"
		>
			<header className="text-center">
				<p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
					Application
				</p>
				<h1
					id="settings-title"
					className="mt-2 text-2xl font-semibold"
				>
					Settings
				</h1>
			</header>

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
					Default uses the standard window size. Bordered fills the screen with its title
					bar. Fullscreen uses the native fullscreen space.
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

			<fieldset
				className="grid gap-3 border-t border-line pt-5"
				disabled={model.blocked}
			>
				<legend className="text-sm font-semibold text-foreground">Developer</legend>
				<label
					className={`ak-list-row ak-list-row-interactive flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line px-4 py-3 ${model.blocked ? "ak-list-row-pending cursor-progress" : ""}`}
					data-ui="SettingsCheatAvailability"
				>
					<span className="grid gap-1">
						<span className="text-sm font-semibold text-foreground">Cheat tools</span>
						<span className="text-sm leading-5 text-muted">
							Shows the save-specific Cheats page in each Game menu. Every save must
							enable Cheat mode separately.
						</span>
					</span>
					<input
						type="checkbox"
						checked={model.cheatToolsAvailable}
						className="size-5 shrink-0 accent-accent"
						onChange={(event) =>
							model.setCheatToolsAvailable(event.currentTarget.checked)
						}
					/>
				</label>
				<SettingsOpenActionRow
					dataUi="SettingsCli"
					title="Command line"
					description={model.cliDescription}
					pending={model.cliPending}
					disabled={model.cliDisabled}
					pendingLabel={model.cliActionLabel}
					idleLabel={model.cliActionLabel}
					onClick={model.toggleCliInstallation}
				/>
				<SettingsOpenActionRow
					dataUi="SettingsDiagnostics"
					title="Diagnostics"
					description="Open the bounded rotating logs used to investigate crashes and broken gameplay sessions."
					pending={model.diagnosticsStatus.kind === "pending"}
					pendingLabel="Opening…"
					idleLabel="Open logs"
					onClick={model.openDiagnostics}
				/>
				<SettingsOpenActionRow
					dataUi="SettingsUserData"
					title="Application data"
					description="Open Arkini's data root containing editor projects, Arkpacks, saves, preferences, and logs."
					pending={model.userDataStatus.kind === "pending"}
					pendingLabel="Opening…"
					idleLabel="Open data folder"
					onClick={model.openUserData}
				/>
			</fieldset>

			<div
				className="min-h-6 text-center text-sm"
				aria-live="polite"
				data-ui="SettingsStatus"
			>
				{model.diagnosticsStatus.kind === "error" ? (
					<p className="text-danger">
						Diagnostics failed: {errorMessage(model.diagnosticsStatus.error)}
					</p>
				) : null}
				{model.userDataStatus.kind === "error" ? (
					<p className="text-danger">
						Opening data folder failed: {errorMessage(model.userDataStatus.error)}
					</p>
				) : null}
				{model.cliStatus.kind === "error" ? (
					<p className="text-danger">
						CLI installation failed: {model.cliStatus.message}
					</p>
				) : null}
				{match(model.status)
					.with(
						{
							kind: "pending",
							action: "window-mode",
						},
						() => <p className="text-accent">Applying window mode…</p>,
					)
					.with(
						{
							kind: "navigation-error",
						},
						({ error }) => (
							<p className="text-danger">Navigation failed: {errorMessage(error)}</p>
						),
					)
					.with(
						{
							kind: "pending",
							action: "cheat-tools",
						},
						() => <p className="text-accent">Saving Cheat tools…</p>,
					)
					.with(
						{
							kind: "pending",
							action: "theme",
						},
						() => <p className="text-accent">Saving theme…</p>,
					)
					.with(
						{
							kind: "pending",
							action: "exit",
						},
						() => null,
					)
					.with(
						{
							kind: "save-error",
						},
						({ error, label }) => (
							<p className="text-danger">
								{label} update failed: {errorMessage(error)}
							</p>
						),
					)
					.with(
						{
							kind: "saved",
						},
						({ label }) => <p className="text-muted">{label} saved.</p>,
					)
					.with(
						{
							kind: "idle",
						},
						() => null,
					)
					.exhaustive()}
			</div>

			<BackButton
				cursorIntent={model.blocked ? "progress" : undefined}
				disabled={model.blocked}
				onClick={model.goBack}
			>
				{model.exitPending ? "Returning…" : "Back"}
			</BackButton>
		</section>
	);
};
