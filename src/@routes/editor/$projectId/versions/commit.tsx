import { createFileRoute } from "@tanstack/react-router";
import { CircleCheckBig } from "lucide-react";

import { PrimaryButton } from "~/ui/ui/Button";
import { editorInputClassName } from "~/editor-control/constant/EditorInputClassName";
import { Status } from "~/ui/ui/Status";
import { useVersionCommitController } from "~/project-version/ui/useVersionCommitController";

interface EditorVersionCommitSearch {
	readonly returnTo?: string;
}

export const Route = createFileRoute("/editor/$projectId/versions/commit")({
	validateSearch: (search): EditorVersionCommitSearch => ({
		returnTo:
			typeof search.returnTo === "string" && search.returnTo.startsWith("/editor/")
				? search.returnTo
				: undefined,
	}),
	component: () => {
		const controller = useVersionCommitController();
		return (
			<div
				className="h-full min-h-0 overflow-y-auto p-4"
				data-ui="EditorVersionCommit"
			>
				<div className="mx-auto grid w-full max-w-3xl gap-4">
					<h2 className="text-lg font-semibold">Commit saved project</h2>
					{controller.status?.canCommit === false ? (
						<Status
							dataUi="EditorVersionCommitClean"
							description="Working copy matches its current base. Change the saved project before creating another version."
							icon={CircleCheckBig}
							title="Working copy is clean"
						/>
					) : (
						<div className="grid gap-4 rounded-2xl border border-line bg-surface-raised/60 p-5">
							<label className="grid gap-1.5 text-sm">
								<span className="font-semibold">Message</span>
								<input
									className={editorInputClassName}
									maxLength={120}
									placeholder="Describe this saved state"
									value={controller.subject}
									onChange={(event) =>
										controller.setSubjectFn(event.currentTarget.value)
									}
								/>
								<span className="text-xs text-subtle">
									{controller.subject.trim().length}/120
								</span>
							</label>
							<label className="grid gap-1.5 text-sm">
								<span className="font-semibold">Details · optional</span>
								<textarea
									className={`${editorInputClassName} min-h-28 resize-y leading-6`}
									maxLength={4000}
									placeholder="Why this state matters, what changed, or what to try next"
									value={controller.body}
									onChange={(event) =>
										controller.setBodyFn(event.currentTarget.value)
									}
								/>
							</label>
							<label className="grid gap-1.5 text-sm">
								<span className="font-semibold">Tag · optional</span>
								<input
									className={editorInputClassName}
									maxLength={80}
									placeholder="safe, balance pass, weird but useful…"
									value={controller.tag}
									onChange={(event) =>
										controller.setTagFn(event.currentTarget.value)
									}
								/>
								<span className="text-xs text-subtle">
									A personal marker, not a branch name.
								</span>
							</label>
							{controller.error === undefined ? null : (
								<p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
									{controller.error}
								</p>
							)}
							<div className="flex items-center justify-between gap-3">
								<span className="text-xs text-subtle">
									{controller.status === undefined
										? "Reading saved state…"
										: `${controller.status.versionCount} saved version${controller.status.versionCount === 1 ? "" : "s"}`}
								</span>
								<PrimaryButton
									disabled={!controller.canCommit || controller.pending}
									cursorIntent={controller.pending ? "progress" : undefined}
									onClick={controller.commitFn}
								>
									Commit version
								</PrimaryButton>
							</div>
						</div>
					)}
				</div>
			</div>
		);
	},
});
