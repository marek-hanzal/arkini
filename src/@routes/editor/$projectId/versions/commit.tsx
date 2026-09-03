import { createFileRoute } from "@tanstack/react-router";
import { CircleCheckBig, GitCommitHorizontal } from "lucide-react";

import { PrimaryButton } from "~/ui/ui/Button";
import { editorInputClassName } from "~/editor-control/constant/EditorInputClassName";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorTextarea } from "~/editor-control/ui/EditorTextarea";
import { EditorValueLabel } from "~/editor-control/ui/EditorValueControls";
import { Status } from "~/ui/ui/Status";
import { useVersionCommitController } from "~/project-version/ui/useVersionCommitController";
import { VersionDiff } from "~/project-version/ui/VersionDiff";

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
		const { preview } = controller;
		return (
			<div
				className="h-full min-h-0 overflow-hidden p-4"
				data-ui="EditorVersionCommit"
			>
				<div className="mx-auto grid h-full min-h-0 w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-4">
					<h2 className="text-lg font-semibold">Commit project</h2>
					{preview?.canCommit === false ? (
						<Status
							dataUi="EditorVersionCommitClean"
							description="Working copy matches its current base. Change the saved project before creating another version."
							icon={CircleCheckBig}
							title="Working copy is clean"
						/>
					) : (
						<div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
							{preview === undefined ? null : (
								<EditorFormCard>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<h3 className="font-semibold">
												{preview.initial
													? `Initial snapshot · v${preview.nextArkpackVersion}`
													: `Resulting Arkpack · v${preview.nextArkpackVersion}`}
											</h3>
											<p className="mt-1 text-sm text-muted">
												{preview.initial
													? "The first commit records the complete project without bumping its starting version."
													: preview.bump === "noop"
														? "Only Editor-only content changed, so the Arkpack version stays unchanged."
														: `This commit applies one ${preview.bump} compatibility bump.`}
											</p>
										</div>
										<span
											className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold uppercase tracking-wider"
											data-ui="EditorVersionCommitBump"
										>
											{preview.bump}
										</span>
									</div>
									{preview.scenariosToDelete.length === 0 ? null : (
										<div
											className="mt-3 rounded-lg bg-warning/12 p-3 text-sm text-warning"
											data-ui="EditorVersionCommitScenarioDeletion"
										>
											This major commit will delete{" "}
											{preview.scenariosToDelete.length} Board scenario
											{preview.scenariosToDelete.length === 1 ? "" : "s"}:{" "}
											{preview.scenariosToDelete.join(", ")}.
										</div>
									)}
								</EditorFormCard>
							)}
							<div className="grid min-h-0 grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] gap-4">
								<div
									className="grid content-start gap-4"
									data-ui="EditorVersionCommitForm"
								>
									<EditorFormCard>
										<label className="grid gap-1.5 text-sm">
											<EditorValueLabel
												description="Required. Give this restore point a short name you will recognize in History and comparison selectors."
												label="Message"
											/>
											<input
												className={editorInputClassName}
												maxLength={120}
												placeholder="Describe this saved state"
												value={controller.subject}
												onChange={(event) =>
													controller.setSubjectFn(
														event.currentTarget.value,
													)
												}
											/>
											<span className="text-xs text-subtle">
												{controller.subject.trim().length}/120
											</span>
										</label>
									</EditorFormCard>
									<EditorFormCard>
										<label className="grid gap-1.5 text-sm">
											<EditorValueLabel
												description="Explain what changed, why this state matters, or what you want to try next."
												label="Details · Optional"
											/>
											<EditorTextarea
												maxLength={4000}
												maxRows={6}
												minRows={2}
												placeholder="Why this state matters, what changed, or what to try next"
												value={controller.body}
												onChange={(event) =>
													controller.setBodyFn(event.currentTarget.value)
												}
											/>
										</label>
									</EditorFormCard>
									<EditorFormCard>
										<label className="grid gap-1.5 text-sm">
											<EditorValueLabel
												description="Add a personal marker for finding related versions. A tag does not create or name a branch."
												label="Tag · Optional"
											/>
											<input
												className={editorInputClassName}
												maxLength={80}
												placeholder="safe, balance pass, weird but useful…"
												value={controller.tag}
												onChange={(event) =>
													controller.setTagFn(event.currentTarget.value)
												}
											/>
										</label>
									</EditorFormCard>
									{controller.error === undefined ? null : (
										<p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
											{controller.error}
										</p>
									)}
									<PrimaryButton
										className="justify-self-end gap-2"
										disabled={!controller.canCommit || controller.pending}
										cursorIntent={controller.pending ? "progress" : undefined}
										onClick={controller.commitFn}
									>
										<GitCommitHorizontal className="size-4" />
										Commit
									</PrimaryButton>
								</div>
								{preview?.diff === undefined ? null : (
									<div
										className="min-h-0 overflow-y-auto overscroll-contain pr-1"
										data-ui="EditorVersionCommitChanges"
									>
										<VersionDiff diff={preview.diff} />
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		);
	},
});
