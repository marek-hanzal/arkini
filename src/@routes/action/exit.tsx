import { createFileRoute } from "@tanstack/react-router";

import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRoute } from "~/page/action/runActionRoute";

export const Route = createFileRoute("/action/exit")({
	loader: () => runActionRoute(() => Promise.resolve()),
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Exiting Arkini…" />,
	component: () => <ActionPendingPage label="Exiting Arkini…" />,
});
