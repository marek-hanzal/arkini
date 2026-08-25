import { AnimatePresence, motion } from "motion/react";

import { EditorNoteContentMaxLength } from "~/editor/note/EditorNoteSchema";
import { Button, PrimaryButton } from "~/ui/button/Button";
import { EditorTextarea } from "~/ui/form/EditorTextarea";
import { Tooltip } from "~/ui/overlay/Tooltip";
import { useEditorNotesController } from "~/ui/note/editor/useEditorNotesController";
import { Status } from "~/ui/status/Status";

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

export const EditorNotes = () => {
	const controller = useEditorNotesController();
	return (
		<div
			className="h-full min-h-0 overflow-y-auto p-4"
			data-ui="EditorNotes"
		>
			<div className="mx-auto grid w-full max-w-3xl gap-6">
				<header>
					<h1 className="text-2xl font-semibold">Notes</h1>
					<p className="mt-1 text-sm text-muted">
						Project notes stay in the Editor and are not included in the arkpack.
					</p>
				</header>
				<section className="grid gap-3 rounded-2xl border border-line bg-surface-raised/60 p-5">
					<EditorTextarea
						maxLength={EditorNoteContentMaxLength}
						maxRows={12}
						minRows={6}
						placeholder="Write a note…"
						disabled={controller.pending}
						value={controller.newContent}
						onChange={(event) => controller.setNewContent(event.currentTarget.value)}
					/>
					<div className="flex items-center justify-end">
						<PrimaryButton
							disabled={!controller.canCreate}
							cursorIntent={controller.pending ? "progress" : undefined}
							onClick={controller.create}
						>
							{controller.pending ? "Saving…" : "Create note"}
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
							<Button onClick={controller.retry}>Retry loading notes</Button>
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
										icon="icon-[lucide--notebook-pen]"
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
																	className={iconButtonClassName}
																	disabled={controller.pending}
																	onClick={controller.cancelEdit}
																>
																	<span className="icon-[lucide--arrow-left] size-4" />
																</Button>
															</Tooltip>
															<Tooltip
																content="Save"
																placement="top"
															>
																<Button
																	className={iconButtonClassName}
																	disabled={
																		!controller.canSaveEdit
																	}
																	cursorIntent={
																		controller.pending
																			? "progress"
																			: undefined
																	}
																	onClick={controller.saveEdit}
																>
																	<span className="icon-[lucide--save] size-4" />
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
																	className={iconButtonClassName}
																	disabled={
																		controller.editingNoteId !==
																			undefined ||
																		controller.pending
																	}
																	onClick={() =>
																		controller.startEdit(note)
																	}
																>
																	<span className="icon-[lucide--pencil] size-4" />
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
																		controller.remove(
																			note.noteId,
																		)
																	}
																>
																	<span className="icon-[lucide--trash-2] size-4" />
																</Button>
															</Tooltip>
														</>
													)}
												</div>
											</header>
											{editing ? (
												<EditorTextarea
													maxLength={EditorNoteContentMaxLength}
													maxRows={12}
													minRows={6}
													disabled={controller.pending}
													value={controller.editContent}
													onChange={(event) =>
														controller.setEditContent(
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
		</div>
	);
};
