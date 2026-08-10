import type { EditorDiagnosticTarget } from "~/ui/arkpack/editor/EditorDiagnosticTarget";
import { ButtonLink } from "~/ui/button/Button";

/** Links one diagnostic target to its canonical editor surface. */
export const EditorDiagnosticLink = ({
	projectId,
	target,
}: {
	readonly projectId: string;
	readonly target: EditorDiagnosticTarget;
}) => {
	switch (target.kind) {
		case "item":
			return (
				<ButtonLink
					className="mt-3 w-fit shadow-none"
					to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
					params={{
						projectId,
						itemUid: target.itemUid,
						sectionId: target.sectionId,
					}}
				>
					Open {target.label}
				</ButtonLink>
			);
		case "asset":
			return (
				<ButtonLink
					className="mt-3 w-fit shadow-none"
					to="/editor/$projectId/assets/$resourceId/detail/overview"
					params={{
						projectId,
						resourceId: target.resourceId,
					}}
				>
					Open asset {target.label}
				</ButtonLink>
			);
		case "project":
			return (
				<ButtonLink
					className="mt-3 w-fit shadow-none"
					to="/editor/$projectId/project/$sectionId"
					params={{
						projectId,
						sectionId: target.sectionId,
					}}
				>
					Open {target.label}
				</ButtonLink>
			);
	}
};
