import { use } from "react";
import { AppearanceContext } from "~/ui/appearance/AppearanceContext";

/** Reads the root appearance state owned by AppearanceProvider. */
export const useAppearance = () => {
	const appearance = use(AppearanceContext);
	if (appearance === undefined) {
		throw new Error("useAppearance must run beneath AppearanceProvider.");
	}
	return appearance;
};
