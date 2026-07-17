import { useMutation } from "@tanstack/react-query";
import { useAppearance } from "~/ui/appearance/useAppearance";
import { setAppearanceThemeMutationOptions } from "~/ui/appearance/mutation/setAppearanceThemeMutationOptions";

/** Runs the complete authoritative appearance-theme mutation. */
export const useSetAppearanceThemeMutation = () => {
	const appearance = useAppearance();
	return useMutation(setAppearanceThemeMutationOptions(appearance));
};
