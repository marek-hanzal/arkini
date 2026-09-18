import { RefreshCw } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorProjectRefreshController } from "~/authoring-session/ui/useEditorProjectRefreshController";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { Button } from "~/ui/ui/Button";
import { Tooltip } from "~/ui/ui/Tooltip";
import { Tx } from "~/translation/ui/Tx";

const ProjectConflictRecovery = () => {
	const project = useEditorProject();
	const refresh = useEditorProjectRefreshController({
		projectId: project.projectId,
		blocked: false,
	});
	return (
		<>
			<div className="min-w-0 flex-1">
				<Tx label="The project changed. Refresh and try again." />
				{refresh.error === undefined ? null : <p className="mt-2">{refresh.tooltip}</p>}
			</div>
			<Tooltip content={refresh.tooltip}>
				<Button
					type="button"
					data-ui="EditorConflictRefresh"
					className="size-9 min-h-0 shrink-0 p-0 shadow-none"
					disabled={refresh.disabled}
					cursorIntent={refresh.pending ? "progress" : undefined}
					onClick={refresh.refreshFn}
				>
					<RefreshCw className="size-5" />
				</Button>
			</Tooltip>
		</>
	);
};

/** Keeps repository diagnostics in logs and offers the canonical hard Refresh for stale drafts. */
export const EditorFormError = ({ error }: { readonly error: unknown }) => {
	if (error === undefined) return null;
	return (
		<div
			data-ui="EditorFormError"
			className="flex items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
		>
			{error instanceof ProjectRepositoryError && error.reason === "revision-conflict" ? (
				<ProjectConflictRecovery />
			) : (
				<p>{error instanceof Error ? error.message : String(error)}</p>
			)}
		</div>
	);
};
