import { ArrowRight } from "lucide-react";

import { EditorOverviewCard } from "~/authoring-shell/ui/EditorOverviewCard";
import { useProjectNotes } from "~/project-note/ui/useProjectNotes";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Tx } from "~/translation/ui/Tx";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { Markdown } from "~/ui/ui/Markdown";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

/** Presents the newest project Note as a bounded Markdown preview. */
export const ProjectNotesOverview = ({ projectId }: { readonly projectId: string }) => {
	const translator = useTranslator();
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
			action={
				<LinkButtonLink
					className="inline-flex items-center gap-1.5 opacity-75 hover:opacity-100"
					data-overview-id="notes"
					data-ui="EditorProjectOverviewLink"
					params={{
						projectId,
					}}
					to="/editor/$projectId/notes"
				>
					<Tx label="Open" />
					<ArrowRight className="size-4" />
				</LinkButtonLink>
			}
			title={translator.textFn("Notes")}
		/>
	);
};
