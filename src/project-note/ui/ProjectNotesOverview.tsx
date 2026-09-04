import { ArrowRight, NotebookPen } from "lucide-react";

import { EditorOverviewCard } from "~/authoring-shell/ui/EditorOverviewCard";
import { useProjectNotes } from "~/project-note/ui/useProjectNotes";
import { Tx } from "~/translation/ui/Tx";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { Markdown } from "~/ui/ui/Markdown";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

/** Presents the newest project Note as a bounded Markdown preview. */
export const ProjectNotesOverview = ({ projectId }: { readonly projectId: string }) => {
	const notes = useProjectNotes(projectId);
	const latest = notes.notes[0];
	return (
		<EditorOverviewCard
			body={
				latest === undefined ? (
					<Tx
						label={
							notes.loaded
								? "Notes empty title"
								: notes.error === undefined
									? "Loading notes…"
									: "Notes unavailable"
						}
					/>
				) : (
					<div className="grid gap-3">
						<time
							className="text-xs font-normal text-subtle"
							dateTime={new Date(latest.updatedAtMs).toISOString()}
						>
							{dateFormatter.format(latest.updatedAtMs)}
						</time>
						<div className="max-h-48 min-w-0 overflow-hidden break-words">
							<Markdown>{latest.content}</Markdown>
						</div>
					</div>
				)
			}
			dataUi="EditorProjectNotesOverview"
			footerRight={
				<LinkButtonLink
					className="inline-flex items-center gap-1.5"
					data-overview-id="notes"
					data-ui="EditorProjectOverviewLink"
					params={{
						projectId,
					}}
					to="/editor/$projectId/notes"
				>
					<Tx label="Notes" />
					<ArrowRight className="size-4" />
				</LinkButtonLink>
			}
			icon={NotebookPen}
			title={<Tx label="Notes" />}
		/>
	);
};
