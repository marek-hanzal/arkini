import { Effect } from "effect";
import { z } from "zod";

import { readEditorProjectFx } from "~/bridge/editor/readEditorProjectFx";
import { checkoutEditorProjectVersionFx } from "~/bridge/editor/version/checkoutEditorProjectVersionFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { ArkiniRouter } from "~/createArkiniRouterFx";
import { IdSchema } from "~/engine/common/schema/IdSchema";

const requestSchema = z
	.object({
		projectId: IdSchema,
		versionId: IdSchema,
	})
	.strict();

export namespace installEditorMcpVersionCheckoutFx {
	export interface Props {
		readonly editorMcp: Pick<Window["arkini"]["editorMcp"], "onVersionCheckoutRequested">;
		readonly rendererRuntime: typeof RendererRuntime;
		readonly router: Pick<ArkiniRouter, "invalidate" | "navigate" | "state">;
	}
}

/** Installs the only MCP checkout path, reusing the renderer's hard-reset coordinator. */
export const installEditorMcpVersionCheckoutFx = Effect.fn("installEditorMcpVersionCheckoutFx")(
	({ editorMcp, rendererRuntime, router }: installEditorMcpVersionCheckoutFx.Props) =>
		Effect.sync(() => {
			let running = false;
			return editorMcp.onVersionCheckoutRequested(async (candidate) => {
				if (running) throw new Error("Another editor version checkout is already running.");
				const request = requestSchema.parse(candidate);
				const isOpen = router.state.matches.some(
					(match) =>
						"projectId" in match.params && match.params.projectId === request.projectId,
				);
				if (!isOpen)
					throw new Error(`Editor project ${request.projectId} is no longer open.`);
				running = true;
				try {
					await rendererRuntime.runPromise(
						readEditorProjectFx({
							projectId: request.projectId,
						}).pipe(
							Effect.flatMap((currentProject) =>
								checkoutEditorProjectVersionFx({
									currentProject,
									versionId: request.versionId,
								}),
							),
						),
					);
					await router.navigate({
						to: "/editor/$projectId/versions/history",
						params: {
							projectId: request.projectId,
						},
						replace: true,
					});
					await router.invalidate();
				} finally {
					running = false;
				}
			});
		}),
);
