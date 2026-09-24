import { match, P } from "ts-pattern";
import { Mx } from "~/translation/ui/Mx";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { NoteForm } from "~/project-note/ui/NoteForm";
import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "~/ui/ui/Button";
import { useNotesController } from "~/project-note/ui/useNotesController";
import { Status } from "~/ui/ui/Status";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Markdown } from "~/ui/ui/Markdown";

import { NoteResourceLinks } from "~/project-note/ui/NoteResourceLinks";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { NoteItemLinks } from "~/project-note/ui/NoteItemLinks";

const MotionEditorRootCard = motion.create(EditorRootCard);

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

interface ProjectNotesProps extends useNotesController.Props {
	readonly artworkFilter?: ArtworkCatalogFilterSchema.Type;
	readonly artworkQuery?: string;
}

/** Shared two-column Notes workspace; the list and composer own independent scroll areas. */
export const ProjectNotes = (props: ProjectNotesProps) => {
	const controller = useNotesController(props);
	const translator = useTranslator();
	return (
		<div
			className="flex h-full min-h-0 min-w-0 flex-col gap-6 overflow-y-auto p-3 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden"
			data-ui="EditorNotes"
		>
			<section
				className="relative grid min-h-0 min-w-0 shrink-0 content-start gap-8 lg:overflow-y-auto lg:overscroll-contain"
				data-ui="EditorNotesList"
			>
				{match(controller)
					.with(
						{
							loading: true,
						},
						() => (
							<p className="text-sm text-muted">
								<Tx label="Loading notes…" />
							</p>
						),
					)
					.with(
						{
							loaded: false,
						},
						() => (
							<div className="flex justify-end">
								<Button onClick={controller.retryFn}>
									<Tx label="Retry loading notes" />
								</Button>
							</div>
						),
					)
					.otherwise(() => (
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
										size="large"
										variant="flat"
										description={
											<Mx
												label={match(props)
													.with(
														{
															requiredCurrentResourceUid: P.string,
														},
														() => "Artwork notes empty description",
													)
													.with(
														{
															requiredCurrentItemUid:
																P.optional(undefined),
														},
														() => "Notes empty description",
													)
													.otherwise(
														() => "Item notes empty description",
													)}
											/>
										}
										icon={NotebookPen}
										title={translator.textFn(
											match(props)
												.with(
													{
														requiredCurrentResourceUid: P.string,
													},
													() => "Artwork notes empty title",
												)
												.with(
													{
														requiredCurrentItemUid:
															P.optional(undefined),
													},
													() => "Notes empty title",
												)
												.otherwise(() => "Item notes empty title"),
										)}
									/>
								</motion.div>
							) : (
								controller.notes.map((note) => {
									const editing = controller.editingNoteId === note.noteId;
									return (
										<MotionEditorRootCard
											key={note.noteId}
											layout="position"
											className="min-w-0 gap-4 border-b border-line/70 pb-8 last:border-b-0 last:pb-0"
											dataUi="EditorNote"
											{...noteMotion}
										>
											<header className="flex items-center gap-3">
												<time className="text-xs text-subtle">
													{dateFormatter.format(note.updatedAtMs)}
												</time>
												{editing ? null : (
													<div className="ml-auto flex items-center">
														<Button
															className={iconButtonClassName}
															disabled={
																controller.editingNoteId !==
																	undefined || controller.pending
															}
															data-ui="EditorNoteEdit"
															onClick={() =>
																controller.startEditFn(note)
															}
														>
															<Pencil className="size-4" />
														</Button>

														<Button
															className={`${iconButtonClassName} hover:text-danger`}
															disabled={
																controller.editingNoteId !==
																	undefined || controller.pending
															}
															data-ui="EditorNoteDelete"
															onClick={() =>
																controller.removeFn(note)
															}
														>
															<Trash2 className="size-4" />
														</Button>
													</div>
												)}
											</header>
											{editing ? (
												<NoteForm
													content={controller.editContent}
													itemUids={controller.editItemUids}
													resourceUids={controller.editResourceUids}
													artworkFilter={props.artworkFilter}
													artworkQuery={props.artworkQuery}
													pending={controller.pending}
													canSave={controller.canSaveEdit}
													saveLabel="Save"
													onContentChangeFn={controller.setEditContentFn}
													onItemUidsChangeFn={
														controller.setEditItemUidsFn
													}
													onResourceUidsChangeFn={
														controller.setEditResourceUidsFn
													}
													onSaveFn={controller.saveEditFn}
													onCancelFn={controller.cancelEditFn}
												/>
											) : (
												<>
													<div className="min-w-0 break-words">
														<Markdown>{note.content}</Markdown>
													</div>
													<NoteItemLinks
														itemUids={note.itemUids}
														disabled={
															controller.pending ||
															controller.editingNoteId !== undefined
														}
														onUnlinkFn={(itemUid) =>
															controller.unlinkFn(note, itemUid)
														}
													/>
													<NoteResourceLinks
														resourceUids={note.resourceUids}
														disabled={
															controller.pending ||
															controller.editingNoteId !== undefined
														}
														onUnlinkFn={(resourceUid) =>
															controller.unlinkResourceFn(
																note,
																resourceUid,
															)
														}
														filter={props.artworkFilter}
														query={props.artworkQuery}
													/>
												</>
											)}
										</MotionEditorRootCard>
									);
								})
							)}
						</AnimatePresence>
					))}
			</section>
			<div
				className="min-h-0 min-w-0 shrink-0 space-y-3 lg:overflow-y-auto lg:overscroll-contain"
				data-ui="EditorNotesComposer"
			>
				{controller.error === undefined ? null : (
					<p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
						{controller.error instanceof Error
							? controller.error.message
							: String(controller.error)}
					</p>
				)}
				<EditorRootCard dataUi="EditorNoteComposerCard">
					<NoteForm
						content={controller.newContent}
						itemUids={controller.newItemUids}
						resourceUids={controller.newResourceUids}
						requiredItemUid={props.requiredCurrentItemUid}
						requiredResourceUid={props.requiredCurrentResourceUid}
						artworkFilter={props.artworkFilter}
						artworkQuery={props.artworkQuery}
						pending={controller.pending}
						canSave={controller.canCreate}
						saveLabel="Create note"
						onContentChangeFn={controller.setNewContentFn}
						onItemUidsChangeFn={controller.setNewItemUidsFn}
						onResourceUidsChangeFn={controller.setNewResourceUidsFn}
						onSaveFn={controller.createFn}
					/>
				</EditorRootCard>
			</div>
		</div>
	);
};
