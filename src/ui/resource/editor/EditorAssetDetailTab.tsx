import { ButtonLink } from "~/ui/button/Button";
import {
	editorSectionTabActiveClassName,
	editorSectionTabClassName,
} from "~/ui/editor/EditorSectionTabs";

export const EditorAssetDetailTab = ({
	filter,
	label,
	projectId,
	query,
	resourceId,
	to,
}: {
	readonly filter: "all" | "unused";
	readonly label: string;
	readonly projectId: string;
	readonly query: string;
	readonly resourceId: string;
	readonly to:
		| "/editor/$projectId/assets/$resourceId/detail/overview"
		| "/editor/$projectId/assets/$resourceId/detail/usage"
		| "/editor/$projectId/assets/$resourceId/detail/technical";
}) => (
	<ButtonLink
		to={to}
		params={{
			projectId,
			resourceId,
		}}
		search={{
			filter,
			query,
		}}
		activeOptions={{
			exact: true,
		}}
		activeProps={{
			"aria-selected": true,
			className: editorSectionTabActiveClassName,
		}}
		inactiveProps={{
			"aria-selected": false,
		}}
		className={editorSectionTabClassName}
		role="tab"
	>
		{label}
	</ButtonLink>
);
