import { Effect } from "effect";
import { z } from "zod";

import { checkoutProjectVersionFx } from "~/project-version/fx/checkoutProjectVersionFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { ArkiniRouter } from "~/createArkiniRouterFx";
import { IdSchema } from "~/game-config/schema/IdSchema";

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
		readonly router: Pick<ArkiniRouter, "navigate" | "state">;
	}
}

/** Installs the only MCP checkout path, reusing the renderer's in-place restore coordinator. */
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
						checkoutProjectVersionFx({
							confirmDiscardCurrentChanges: true,
							projectId: request.projectId,
							versionId: request.versionId,
						}),
					);
					await router.navigate({
						to: "/editor/$projectId/versions/history",
						params: {
							projectId: request.projectId,
						},
						replace: true,
					});
				} finally {
					running = false;
				}
			});
		}),
);
