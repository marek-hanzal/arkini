import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { useAppearance } from "~/ui/appearance/useAppearance";
import { useSetAppearanceThemeMutation } from "~/ui/appearance/mutation/useSetAppearanceThemeMutation";
import { PrimaryButton } from "~/ui/button/Button";
import { LauncherScene } from "~/ui/launcher/LauncherScene";

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

/** Renders the one authoritative application appearance setting. */
export const Settings = () => {
	const navigate = useNavigate();
	const appearance = useAppearance();
	const setTheme = useSetAppearanceThemeMutation();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || setTheme.isPending) return;
			event.preventDefault();
			void navigate({
				to: "/main-menu",
			});
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		navigate,
		setTheme.isPending,
	]);

	return (
		<LauncherScene
			compactHero
			dataUi="Settings"
		>
			<section className="grid w-full max-w-xl gap-5 rounded-2xl border border-line bg-surface/80 p-6 shadow-2xl backdrop-blur-xl">
				<header className="text-center">
					<p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
						Application
					</p>
					<h1 className="mt-2 text-2xl font-semibold">Settings</h1>
				</header>

				<fieldset
					className="grid gap-3"
					disabled={setTheme.isPending}
				>
					<legend className="text-sm font-semibold text-foreground">Theme</legend>
					<div
						className="grid grid-cols-3 rounded-xl border border-line bg-surface-raised/65 p-1"
						role="radiogroup"
						aria-label="Theme"
					>
						{ThemeOptions.map((option) => {
							const selected = appearance.theme === option.value;
							return (
								<label
									key={option.value}
									className={`relative cursor-pointer rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-accent ${
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
										onChange={() => setTheme.mutate(option.value)}
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
				>
					{setTheme.isPending ? (
						<p className="text-accent">Saving theme…</p>
					) : setTheme.isError ? (
						<p className="text-danger">Theme update failed: {String(setTheme.error)}</p>
					) : setTheme.isSuccess ? (
						<p className="text-muted">Theme saved.</p>
					) : null}
				</div>

				<PrimaryButton
					className="mx-auto"
					disabled={setTheme.isPending}
					onClick={() =>
						void navigate({
							to: "/main-menu",
						})
					}
				>
					Return to main menu
				</PrimaryButton>
			</section>
		</LauncherScene>
	);
};
