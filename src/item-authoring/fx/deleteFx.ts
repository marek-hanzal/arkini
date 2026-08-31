import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";

export namespace deleteFx {
	export interface Props {
		readonly expectedRevision: number;
		readonly force: boolean;
		readonly itemUid: string;
		readonly projectId: string;
	}
}

/** Deletes one item under the requested safe or force contract and publishes the commit. */
export const deleteFx = Effect.fn("deleteFx")(function* (props: deleteFx.Props) {
	const repository = yield* ProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const commit = yield* repository.deleteItemFx(props);
			yield* publishEditorProjectFx(props.projectId, {
				commit,
			});
			return commit;
		}),
	);
});
