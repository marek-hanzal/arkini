import type { Effect } from "effect";
import { match } from "ts-pattern";

import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { Button, PrimaryButton } from "~/ui/button/Button";
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
				<legend className="text-sm font-semibold text-foreground">Theme</legend>
				<div
					className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-raised/65 p-1"
					role="radiogroup"
					aria-label="Theme"
					data-ui="SettingsThemeOptions"
				>
					{ThemeOptions.map((option) => {
						const selected = model.theme === option.value;
						return (
							<label
								key={option.value}
								className={`relative rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition-colors ${
									model.blocked
										? selected
											? "cursor-progress bg-accent text-accent-contrast opacity-60"
											: "cursor-progress text-muted opacity-60"
										: selected
											? "cursor-pointer bg-accent text-accent-contrast hover:bg-accent-hover"
											: "cursor-pointer text-muted hover:bg-surface"
								}`}
								data-selected={selected ? "true" : "false"}
								data-pending={model.blocked ? "true" : "false"}
							>
								<input
									type="radio"
									name="appearance-theme"
									value={option.value}
									checked={selected}
									className="sr-only"
									onChange={() => model.selectTheme(option.value)}
								/>
								{option.label}
							</label>
						);
					})}
				</div>
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
				<div
					className="ak-list-row flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3"
					data-ui="SettingsDiagnostics"
				>
					<span className="grid gap-1">
						<span className="text-sm font-semibold text-foreground">Diagnostics</span>
						<span className="text-sm leading-5 text-muted">
							Open the bounded rotating logs used to investigate crashes and broken
							gameplay sessions.
						</span>
					</span>
					<Button
						className="shrink-0"
						cursorIntent={
							model.diagnosticsStatus.kind === "pending" ? "progress" : undefined
						}
						disabled={model.diagnosticsStatus.kind === "pending"}
						onClick={model.openDiagnostics}
					>
						{model.diagnosticsStatus.kind === "pending" ? "Opening…" : "Open logs"}
					</Button>
				</div>
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
				{match(model.status)
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

			<PrimaryButton
				className="mx-auto"
				cursorIntent={model.blocked ? "progress" : undefined}
				disabled={model.blocked}
				onClick={model.goBack}
			>
				{model.exitPending ? "Returning…" : "Back"}
			</PrimaryButton>
		</section>
	);
};
