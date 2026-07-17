import type { ChangeEvent } from "react";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { useAppearance } from "~/ui/appearance/useAppearance";

/** Exposes the temporary global dark, light, or system preference selector. */
export const AppearanceControl = () => {
	const { theme, switching, setTheme } = useAppearance();
	const selectTheme = (event: ChangeEvent<HTMLSelectElement>) => {
		setTheme(event.currentTarget.value as AppearanceTheme);
	};

	return (
		<label
			className="absolute right-3 top-3 z-40 rounded-full border border-line bg-surface-raised/90 p-1 shadow-lg backdrop-blur-md"
			data-ui="AppearanceControl"
		>
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
	);
};
