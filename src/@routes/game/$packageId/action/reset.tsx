import { createFileRoute, redirect } from "@tanstack/react-router";

import { resetGameEngineResourceFx } from "~/bridge/game/resetGameEngineResourceFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { ActionErrorPage } from "~/page/action/ActionErrorPage";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRoute } from "~/page/action/runActionRoute";

export const Route = createFileRoute("/game/$packageId/action/reset")({
	loader: async ({ context, params }) => {
		await runActionRoute(() =>
			RendererRuntime.runPromise(
				resetGameEngineResourceFx({
					queryClient: context.queryClient,
					resource: context.gameEngineResource,
				}),
			),
		);
		throw redirect({
			to: "/game/$packageId/board",
			params,
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Destroying current progress…" />,
	errorComponent: (props) => (
		<ActionErrorPage
			{...props}
			description="The destructive reset stopped before a fresh Game Engine could be created. Retrying resumes the same idempotent disposal and save-clear sequence."
			title="Reset failed"
		/>
	),
});
