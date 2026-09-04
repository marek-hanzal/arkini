import { createId } from "@paralleldrive/cuid2";
import { useState } from "react";

import { ProjectIdDialogForm } from "~/project-authoring/ui/ProjectIdDialogForm";

interface ProjectCreateDialogProps {
	readonly error?: unknown;
	readonly pending: boolean;
	readonly onCancelFn: () => void;
	readonly onCreateFn: (projectId: string) => void;
}

/** Collects the package identity before creating one managed Editor project. */
export const ProjectCreateDialog = ({
	error,
	pending,
	onCancelFn,
	onCreateFn,
}: ProjectCreateDialogProps) => {
	const [initialProjectId] = useState(() => `project-${createId()}`);
	return (
		<ProjectIdDialogForm
			error={error}
			initialProjectId={initialProjectId}
			mode="create"
			onCancelFn={onCancelFn}
			onSubmitFn={onCreateFn}
			pending={pending}
		/>
	);
};
