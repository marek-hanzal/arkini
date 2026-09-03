import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, NotebookPen, Pencil, Save, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { NoteContentMaxLength } from "~/project-note/schema/NoteSchema";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { EditorTextarea } from "~/editor-control/ui/EditorTextarea";
import { Tooltip } from "~/ui/ui/Tooltip";
import { useNotesController } from "~/project-note/ui/useNotesController";
import { Status } from "~/ui/ui/Status";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { Tx } from "~/translation/ui/Tx";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

const iconButtonClassName =
	"size-8 min-h-0 border-0 bg-transparent p-0 text-muted shadow-none hover:border-transparent hover:bg-transparent hover:text-foreground active:bg-transparent disabled:hover:bg-transparent";
const noteMotion = {
	animate: {
		opacity: 1,
		scale: 1,
		y: 0,
	},
	exit: {
		opacity: 0,
		scale: 0.98,
		y: -8,
	},
	initial: {
		opacity: 0,
		scale: 0.98,
		y: -8,
	},
	transition: {
		duration: 0.2,
		ease: [
			0.22,
			1,
			0.36,
			1,
		] as const,
	},
} as const;

export const Route = createFileRoute("/editor/$projectId/notes")({
	component: () => {
		const controller = useNotesController();
		const project = useEditorProject();
		return (
			<EditorSectionPage
				header={
					<EditorSectionNavigation
						leading={
							<EditorHistoryBackButton
								params={{
									projectId: project.projectId,
								}}
								to="/editor/$projectId/editor/items/list"
							/>
						}
						title={
							<h1 className="text-xl font-semibold">
								<Tx label="Notes" />
							</h1>
						}
					/>
				}
			>
				<div
					className="mx-auto grid w-full max-w-3xl gap-6"
					data-ui="EditorNotes"
				>
					<p className="text-sm text-muted">
						Project notes stay in the Editor and are not included in the arkpack.
					</p>
					<section className="grid gap-3 rounded-2xl border border-line bg-surface-raised/60 p-5">
						<EditorTextarea
							maxLength={NoteContentMaxLength}
							maxRows={12}
							minRows={6}
							placeholder="Write a note…"
							disabled={controller.pending}
							value={controller.newContent}
							onChange={(event) =>
								controller.setNewContentFn(event.currentTarget.value)
							}
						/>
						<div className="flex items-center justify-end">
							<PrimaryButton
								disabled={!controller.canCreate}
								cursorIntent={controller.pending ? "progress" : undefined}
								onClick={controller.createFn}
							>
								Create note
							</PrimaryButton>
						</div>
					</section>
					{controller.error === undefined ? null : (
						<p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
							{controller.error instanceof Error
								? controller.error.message
								: String(controller.error)}
						</p>
					)}
					<section className="grid gap-4">
						{controller.loading ? (
							<p className="text-sm text-muted">Loading notes…</p>
						) : !controller.loaded ? (
							<div className="flex justify-end">
								<Button onClick={controller.retryFn}>Retry loading notes</Button>
							</div>
						) : (
							<AnimatePresence
								initial={false}
								mode="popLayout"
							>
								{controller.notes.length === 0 ? (
									<motion.div
										key="empty"
										layout="position"
										{...noteMotion}
									>
										<Status
											dataUi="EditorNotesEmpty"
											description="Write the first one above to start a lightweight project journal."
											icon={NotebookPen}
											title="Your notes will live here"
										/>
									</motion.div>
								) : (
									controller.notes.map((note) => {
										const editing = controller.editingNoteId === note.noteId;
										return (
											<motion.article
												key={note.noteId}
												layout="position"
												className="grid gap-4 rounded-2xl border border-line bg-surface-raised/60 p-5"
												data-ui="EditorNote"
												{...noteMotion}
											>
												<header className="flex items-center gap-3">
													<time className="text-xs text-subtle">
														{dateFormatter.format(note.updatedAtMs)}
													</time>
													<div className="ml-auto flex items-center gap-2">
														{editing ? (
															<>
																<Tooltip
																	content="Cancel edit"
																	placement="top"
																>
																	<Button
																		className={
																			iconButtonClassName
																		}
																		disabled={
																			controller.pending
																		}
																		onClick={
																			controller.cancelEditFn
																		}
																	>
																		<ArrowLeft className="size-4" />
																	</Button>
																</Tooltip>
																<Tooltip
																	content="Save"
																	placement="top"
																>
																	<Button
																		className={
																			iconButtonClassName
																		}
																		disabled={
																			!controller.canSaveEdit
																		}
																		cursorIntent={
																			controller.pending
																				? "progress"
																				: undefined
																		}
																		onClick={
																			controller.saveEditFn
																		}
																	>
																		<Save className="size-4" />
																	</Button>
																</Tooltip>
															</>
														) : (
															<>
																<Tooltip
																	content="Edit"
																	placement="top"
																>
																	<Button
																		className={
																			iconButtonClassName
																		}
																		disabled={
																			controller.editingNoteId !==
																				undefined ||
																			controller.pending
																		}
																		onClick={() =>
																			controller.startEditFn(
																				note,
																			)
																		}
																	>
																		<Pencil className="size-4" />
																	</Button>
																</Tooltip>
																<Tooltip
																	content="Delete"
																	placement="top"
																>
																	<Button
																		className={`${iconButtonClassName} hover:text-danger`}
																		disabled={
																			controller.editingNoteId !==
																				undefined ||
																			controller.pending
																		}
																		onClick={() =>
																			controller.removeFn(
																				note.noteId,
																			)
																		}
																	>
																		<Trash2 className="size-4" />
																	</Button>
																</Tooltip>
															</>
														)}
													</div>
												</header>
												{editing ? (
													<EditorTextarea
														maxLength={NoteContentMaxLength}
														maxRows={12}
														minRows={6}
														disabled={controller.pending}
														value={controller.editContent}
														onChange={(event) =>
															controller.setEditContentFn(
																event.currentTarget.value,
															)
														}
													/>
												) : (
													<p className="whitespace-pre-wrap break-words text-sm leading-6">
														{note.content}
													</p>
												)}
											</motion.article>
										);
									})
								)}
							</AnimatePresence>
						)}
					</section>
				</div>
			</EditorSectionPage>
		);
	},
});
