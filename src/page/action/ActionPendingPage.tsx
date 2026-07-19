import { ActionLoadingScreen } from "~/ui/loading/ActionLoadingScreen";

/** Renders one route-owned Hero loading surface while its leaf loader is pending. */
export const ActionPendingPage = ({ label }: { readonly label: string }) => (
	<ActionLoadingScreen label={label} />
);
