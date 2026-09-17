import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { Effect } from "effect";

import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";

/** Deletes one Editor resource and publishes the canonical project snapshot. */
export const deleteEditorResourceFx = Effect.fn("deleteEditorResourceFx")(function* (props: {
	readonly expectedRevision: number;
	readonly projectId: string;
	readonly resourceId: string;
	readonly onDeletedFn?: () => Promise<void>;
}) {
	const repository = yield* ProjectRepository;
	const admission = yield* ProjectWriteAdmission;
	yield* Effect.yieldNow;
	return yield* admission.admitWriteFx(
		"delete-resource",
		Effect.uninterruptible(
			Effect.gen(function* () {
				const { onDeletedFn, ...request } = props;
				const project = yield* repository.deleteResourceFx(request);
				// Depart before publication can unmount detail readers. Refresh owns navigation while draining this command.
				yield* Effect.tryPromise({
					try: () =>
						admission.isNavigationBlockedFn()
							? Promise.resolve()
							: (onDeletedFn?.() ?? Promise.resolve()),
					catch: (cause) => cause,
				}).pipe(
					Effect.ensuring(
						publishEditorProjectFx(props.projectId, {
							project,
						}),
					),
				);
				return project;
			}),
		),
	);
});
