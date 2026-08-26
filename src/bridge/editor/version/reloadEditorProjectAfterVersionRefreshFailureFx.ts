import { Effect } from "effect";

export namespace reloadEditorProjectAfterVersionRefreshFailureFx {
	export interface Props {
		readonly cause: unknown;
		readonly projectId: string;
	}
}

/** Fails closed when the project was restored but the renderer could not publish its fresh truth. */
export const reloadEditorProjectAfterVersionRefreshFailureFx = Effect.fn(
	"reloadEditorProjectAfterVersionRefreshFailureFx",
)(({ cause, projectId }: reloadEditorProjectAfterVersionRefreshFailureFx.Props) =>
	Effect.sync(() => {
		console.error(
			`Arkini editor project ${projectId} was restored but could not be refreshed in place. Reloading the renderer as a last resort.`,
			cause,
		);
		window.location.reload();
	}).pipe(Effect.andThen(Effect.never)),
);
