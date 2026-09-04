import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";

/** Projects repository identity conflicts back onto the Project ID form control. */
export const readProjectIdCollisionErrorFn = (error: unknown) => {
	if (!(error instanceof ProjectRepositoryError)) return undefined;
	if (
		error.operation === "create-project" &&
		/^Editor project .+ already exists\.$/.test(error.message)
	)
		return "A project with this ID already exists.";
	if (
		error.operation === "replace-config" &&
		/^Editor project ID .+ is already open\.$/.test(error.message)
	)
		return "A project with this ID is already open.";
	return undefined;
};
