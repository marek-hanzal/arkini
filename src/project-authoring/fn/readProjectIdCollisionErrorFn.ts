import { match, P } from "ts-pattern";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

/** Projects repository identity conflicts back onto the Project ID form control. */
export const readProjectIdCollisionErrorFn = (error: unknown) => {
	if (!(error instanceof ProjectRepositoryError)) return undefined;
	return match(error)
		.with(
			{
				operation: "create-project",
				message: P.string.regex(/^Editor project .+ already exists\.$/),
			},
			() => "A project with this ID already exists.",
		)
		.with(
			{
				operation: "replace-config",
				message: P.string.regex(/^Editor project ID .+ is already open\.$/),
			},
			() => "A project with this ID is already open.",
		)
		.otherwise(() => undefined);
};
