import { Context, type Effect } from "effect";

import type {
	ProjectRepositoryError,
	ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";

export type ProjectReplacementOperation = "checkout-version" | "refresh-project";

export interface ProjectWriteAdmissionService {
	readonly isNavigationBlockedFn: () => boolean;
	readonly acquireIdentityRenameFx: (
		isNavigationPendingFn: () => boolean,
	) => Effect.Effect<Effect.Effect<void, never, never>, ProjectRepositoryError, never>;
	readonly acquireReplacementFx: (
		operation: ProjectReplacementOperation,
		isNavigationPendingFn: () => boolean,
	) => Effect.Effect<Effect.Effect<void, never, never>, ProjectRepositoryError, never>;
	readonly admitWriteFx: <Value, Error, Requirements>(
		operation: ProjectRepositoryOperation,
		effect: Effect.Effect<Value, Error, Requirements>,
	) => Effect.Effect<Value, Error | ProjectRepositoryError, Requirements>;
}

/** Excludes writes and navigation during replacement, and navigation through an identity rename's terminal route. */
export class ProjectWriteAdmission extends Context.Service<
	ProjectWriteAdmission,
	ProjectWriteAdmissionService
>()("ProjectWriteAdmission") {
	//
}
