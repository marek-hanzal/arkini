import { Context, type Effect } from "effect";

import type {
	ProjectRepositoryError,
	ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";

export type ProjectReplacementOperation = "checkout-version" | "refresh-project";

export interface ProjectWriteAdmissionService {
	readonly acquireReplacementFx: (
		operation: ProjectReplacementOperation,
	) => Effect.Effect<Effect.Effect<void, never, never>, ProjectRepositoryError, never>;
	readonly admitWriteFx: <Value, Error, Requirements>(
		operation: ProjectRepositoryOperation,
		effect: Effect.Effect<Value, Error, Requirements>,
	) => Effect.Effect<Value, Error | ProjectRepositoryError, Requirements>;
}

/** Renderer-lifecycle authority that excludes ordinary writes during project replacement. */
export class ProjectWriteAdmission extends Context.Service<
	ProjectWriteAdmission,
	ProjectWriteAdmissionService
>()("ProjectWriteAdmission") {
	//
}
