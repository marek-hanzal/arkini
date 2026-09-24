import { ShortcutLabel } from "~/ui/ui/ShortcutLabel";
import { formatForDisplay } from "@tanstack/react-hotkeys";

import { useTranslator } from "~/translation/ui/useTranslator";
import { sectionLinkClassName } from "~/ui/constant/SectionLinkClassName";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { Tooltip } from "~/ui/ui/Tooltip";
import type { SectionDescriptor } from "~/item-authoring/type/Section";

const activeProps = {
	"data-ui-selected": true,
} as const;
const inactiveProps = {
	"data-ui-selected": false,
} as const;

export const SectionLink = ({
	defaultTitle,
	destination = "form",
	create,
	itemUid,
	projectId,
	resourceUid,
	section,
}: {
	readonly defaultTitle?: string;
	readonly destination?: "detail" | "form";
	readonly create?: boolean;
	readonly itemUid: string;
	readonly projectId: string;
	readonly resourceUid?: string;
	readonly section: SectionDescriptor;
}) => {
	const translator = useTranslator();
	const label = translator.textFn(section.label);
	const link = (
		<LinkButtonLink
			to={
				destination === "detail"
					? "/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
					: "/editor/$projectId/editor/items/$itemUid/form/$sectionId"
			}
			params={{
				projectId,
				itemUid,
				sectionId: section.id,
			}}
			search={{
				...(defaultTitle === undefined
					? {}
					: {
							defaultTitle,
						}),
				...(create === undefined
					? {}
					: {
							create,
						}),
				...(resourceUid === undefined
					? {}
					: {
							resourceUid,
						}),
			}}
			activeProps={activeProps}
			inactiveProps={inactiveProps}
			className={sectionLinkClassName}
		>
			<ShortcutLabel
				label={label}
				shortcut={section.shortcut}
			/>
		</LinkButtonLink>
	);
	if (section.shortcut === undefined) return link;
	return (
		<Tooltip
			content={`${label} · ${formatForDisplay({
				key: section.shortcut,
			})}`}
			placement="bottom"
		>
			{link}
		</Tooltip>
	);
};
