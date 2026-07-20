import { match } from "ts-pattern";

import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { PrimaryButton } from "~/ui/button/Button";
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

export namespace Settings {
	export interface Props {
		readonly exitPending?: boolean;
		readonly navigationError?: unknown;
		readonly onBack: () => void;
	}
}

/** Renders the reusable authoritative application settings content. */
export const Settings = ({ exitPending = false, navigationError, onBack }: Settings.Props) => {
	const model = useSettingsModel({
		exitPending,
		navigationError,
		onBack,
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
					className="grid grid-cols-3 rounded-xl border border-line bg-surface-raised/65 p-1"
					role="radiogroup"
					aria-label="Theme"
					data-ui="SettingsThemeOptions"
				>
					{ThemeOptions.map((option) => {
						const selected = model.theme === option.value;
						return (
							<label
								key={option.value}
								className={`relative ${model.blocked ? "cursor-progress" : "cursor-pointer"} rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-accent ${
									selected
										? "bg-accent text-accent-contrast shadow-md"
										: "text-muted hover:bg-surface hover:text-foreground"
								}`}
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

			<div
				className="min-h-6 text-center text-sm"
				aria-live="polite"
				data-ui="SettingsStatus"
			>
				{match(model.status)
					.with(
						{
							kind: "navigation-error",
						},
						({ message }) => (
							<p className="text-danger">Navigation failed: {message}</p>
						),
					)
					.with(
						{
							kind: "saving",
						},
						() => <p className="text-accent">Saving theme…</p>,
					)
					.with(
						{
							kind: "save-error",
						},
						({ message }) => (
							<p className="text-danger">Theme update failed: {message}</p>
						),
					)
					.with(
						{
							kind: "saved",
						},
						() => <p className="text-muted">Theme saved.</p>,
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
				onClick={onBack}
			>
				{model.exitPending ? "Returning…" : "Back"}
			</PrimaryButton>
		</section>
	);
};
