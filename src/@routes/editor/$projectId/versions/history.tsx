import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, Save } from "lucide-react";
import { twMerge } from "tailwind-merge";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Status } from "~/ui/ui/Status";
import { editorInputClassName } from "~/editor-control/constant/EditorInputClassName";
import { Tooltip } from "~/ui/ui/Tooltip";
import { VersionCheckoutDialog } from "~/project-version/ui/VersionCheckoutDialog";
import { VersionDiff } from "~/project-version/ui/VersionDiff";
import { VersionGraph } from "~/project-version/ui/VersionGraph";
import { EditorVersionReferenceSelect } from "~/project-version/ui/EditorVersionReferenceSelect";
import { useVersionHistoryController } from "~/project-version/ui/useVersionHistoryController";

const VersionCreatedAt = ({ createdAtMs }: { readonly createdAtMs: number }) => {
	const createdAt = new Date(createdAtMs);
	return <time dateTime={createdAt.toISOString()}>{createdAt.toLocaleString()}</time>;
};

export const Route = createFileRoute("/editor/$projectId/versions/history")({
	component: () => {
		const controller = useVersionHistoryController();
		const versions = controller.history?.versions ?? [];
		const selectedParent = versions.find(
			(version) => version.versionId === controller.selected?.parentVersionId,
		);
		return (
			<div
				className="grid h-full min-h-0 lg:grid-cols-[minmax(20rem,0.85fr)_minmax(24rem,1.15fr)]"
				data-ui="EditorVersionHistory"
			>
				<section className="min-h-0 overflow-y-auto border-r border-line">
					{controller.history === undefined || controller.graph === undefined ? (
						<p className="p-4 text-sm text-muted">Reading version history…</p>
					) : (
						<VersionGraph
							layout={controller.graph}
							onRestoreFn={controller.restoreVersionFn}
							onSelectFn={controller.selectVersionFn}
							onSelectWorkingCopyFn={controller.selectWorkingCopyFn}
							restorePending={controller.checkoutPending}
							selectedReference={controller.compareTo}
							status={controller.history.status}
						/>
					)}
				</section>
				<section className="min-h-0 overflow-y-auto p-4">
					<div className="grid gap-5">
						<EditorRootCard dataUi="EditorVersionCompareCard">
							<div>
								<h2 className="font-semibold">Compare</h2>
								<p className="mt-1 text-xs text-muted">
									Select the working copy or any saved version on either side.
								</p>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<EditorVersionReferenceSelect
									label="Before"
									onChangeFn={controller.setCompareFromFn}
									value={controller.compareFrom}
									versions={versions}
								/>
								<EditorVersionReferenceSelect
									label="After"
									onChangeFn={controller.setCompareToFn}
									value={controller.compareTo}
									versions={versions}
								/>
							</div>
						</EditorRootCard>
						{controller.error === undefined ? null : (
							<p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
								{controller.error}
							</p>
						)}
						{controller.selected === undefined ? (
							controller.compareTo === "current" ? null : (
								<p className="text-sm text-muted">
									Create or select a saved version.
								</p>
							)
						) : (
							<EditorRootCard dataUi="EditorVersionInfoCard">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0">
										<h2 className="break-words text-lg font-semibold">
											{controller.selected.subject}
										</h2>
										<p className="mt-1 text-xs text-muted">
											Arkini {controller.selected.arkini} · Arkpack{" "}
											{controller.selected.arkpackVersion}
										</p>
										<dl className="mt-3 grid min-w-0 gap-3 text-xs sm:grid-cols-2">
											<div>
												<dt className="font-semibold uppercase tracking-wider text-subtle">
													Created
												</dt>
												<dd className="mt-1 text-muted">
													<VersionCreatedAt
														createdAtMs={
															controller.selected.createdAtMs
														}
													/>
												</dd>
											</div>
											<div className="min-w-0">
												<dt className="font-semibold uppercase tracking-wider text-subtle">
													Parent
												</dt>
												<dd className="mt-1 min-w-0 text-muted">
													{controller.selected.parentVersionId ===
													undefined ? (
														"No parent"
													) : selectedParent === undefined ? (
														"Parent unavailable"
													) : (
														<Tooltip
															content={selectedParent.subject}
															placement="top-start"
														>
															<LinkButton
																className="block max-w-full truncate text-left"
																onClick={() =>
																	controller.selectVersionFn(
																		selectedParent.versionId,
																	)
																}
															>
																{selectedParent.subject}
															</LinkButton>
														</Tooltip>
													)}
												</dd>
											</div>
										</dl>
									</div>
								</div>
								{controller.selected.body === undefined ? null : (
									<p className="whitespace-pre-wrap text-sm leading-6 text-muted">
										{controller.selected.body}
									</p>
								)}
								<label className="grid gap-1.5 text-sm">
									<span className="font-semibold">Tag</span>
									<div className="flex items-center gap-2">
										<input
											className={twMerge(
												editorInputClassName,
												"h-9 min-h-0 min-w-0 py-1.5",
											)}
											maxLength={80}
											placeholder="No tag"
											value={controller.tagDraft}
											onChange={(event) =>
												controller.setTagDraftFn(event.currentTarget.value)
											}
										/>
										<LinkButton
											className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap"
											cursorIntent={
												controller.tagPending ? "progress" : undefined
											}
											disabled={controller.tagPending}
											onClick={controller.saveTagFn}
										>
											<Save className="size-4" />
											Save
										</LinkButton>
									</div>
								</label>
							</EditorRootCard>
						)}
						{controller.diffPending ? (
							<Status
								dataUi="EditorVersionDiffLoading"
								description="Reading the differences between the selected states."
								icon={LoaderCircle}
								iconSpin
								title="Comparing versions…"
							/>
						) : controller.diff === undefined ? null : (
							<VersionDiff diff={controller.diff} />
						)}
					</div>
				</section>
				{controller.confirmVersion === undefined ? null : (
					<VersionCheckoutDialog
						onCancelFn={controller.cancelCheckoutFn}
						onCommitFn={controller.goToCommitFn}
						onRestoreFn={controller.confirmCheckoutFn}
						pending={controller.checkoutPending}
						version={controller.confirmVersion}
					/>
				)}
			</div>
		);
	},
});
