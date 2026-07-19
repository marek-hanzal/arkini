import { ActionLoadingScreen } from "~/ui/loading/ActionLoadingScreen";

/** Renders one route-owned Hero loading surface through pending and terminal frames. */
export const ActionPendingPage = ({
	completed,
	label,
}: {
	readonly completed?: boolean;
	readonly label: string;
}) => (
	<ActionLoadingScreen
		completed={completed}
		label={label}
	/>
);
