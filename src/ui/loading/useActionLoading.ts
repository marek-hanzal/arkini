import { useContext } from "react";
import { ActionLoadingContext } from "~/ui/loading/ActionLoadingContext";

/** Reads the one root loading-action presentation owner. */
export const useActionLoading = () => {
	const control = useContext(ActionLoadingContext);
	if (control === null) throw new Error("ActionLoadingProvider is missing.");
	return control;
};
