import type { ChangeEvent } from "react";
import type { AppearanceAccent } from "~/bridge/appearance/AppearanceAccent";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { useAppearance } from "~/ui/appearance/useAppearance";

/** Exposes the root appearance theme and accent preferences. */
export const AppearanceControl = () => {
	const { theme, accent, switching, setTheme, setAccent } = useAppearance();
	const selectTheme = (event: ChangeEvent<HTMLSelectElement>) => {
		setTheme(event.currentTarget.value as AppearanceTheme);
	};
	const selectAccent = (event: ChangeEvent<HTMLSelectElement>) => {
		setAccent(event.currentTarget.value as AppearanceAccent);
	};

	return (
		<div
			className="absolute right-3 top-3 z-40 flex items-center gap-1 rounded-full border border-line bg-surface-raised/90 p-1 shadow-lg backdrop-blur-md"
			data-ui="AppearanceControl"
		>
			<label>
				<span className="sr-only">Appearance theme</span>
				<select
					className="h-8 cursor-pointer rounded-full border-0 bg-transparent px-2 text-xs font-semibold text-foreground outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:text-subtle"
					aria-label="Appearance theme"
					disabled={switching}
					value={theme}
					onChange={selectTheme}
				>
					<option value="dark">Dark</option>
					<option value="light">Light</option>
					<option value="system">System</option>
				</select>
			</label>
			<label>
				<span className="sr-only">Accent color</span>
				<select
					className="h-8 cursor-pointer rounded-full border-0 bg-transparent px-2 text-xs font-semibold text-foreground outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:text-subtle"
					aria-label="Accent color"
					disabled={switching}
					value={accent}
					onChange={selectAccent}
				>
					<option value="rose">Rose</option>
					<option value="violet">Violet</option>
					<option value="blue">Blue</option>
					<option value="green">Green</option>
					<option value="amber">Amber</option>
				</select>
			</label>
		</div>
	);
};
