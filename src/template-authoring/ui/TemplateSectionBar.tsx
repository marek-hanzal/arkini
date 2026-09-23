import { useNavigate } from "@tanstack/react-router";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { Mx } from "~/translation/ui/Mx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { sectionLinkClassName } from "~/ui/constant/SectionLinkClassName";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { ShortcutLabel } from "~/ui/ui/ShortcutLabel";
import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";

export const TemplateSectionBar = ({
	projectId,
	templateUid,
	destination,
}: {
	readonly projectId: string;
	readonly templateUid: string;
	readonly section: "general" | "board" | "delete";
	readonly destination: "detail" | "form";
}) => {
	const translator = useTranslator();
	const navigateFn = useNavigate();
	const options = [
		{
			value: "general",
			label: translator.textFn("General"),
			shortcut: "g",
		},
		{
			value: "board",
			label: translator.textFn("Board"),
			shortcut: "b",
		},
		...(destination === "detail"
			? [
					{
						value: "delete",
						label: translator.textFn("Delete"),
						shortcut: "d",
					},
				]
			: []),
	];
	const to =
		destination === "detail"
			? "/editor/$projectId/templates/$templateUid/detail/$sectionId"
			: "/editor/$projectId/templates/$templateUid/form/$sectionId";
	useSectionShortcuts({
		options,
		onSelectFn: (option) => {
			void navigateFn({
				to,
				params: {
					projectId,
					templateUid,
					sectionId: option.value,
				},
			});
		},
	});
	return (
		<EditorSectionBar
			help={
				<EditorPageHelp
					title={translator.textFn("Templates")}
					content={<Mx label="Templates help" />}
				/>
			}
		>
			{options.map((option) => (
				<LinkButtonLink
					key={option.value}
					to={to}
					params={{
						projectId,
						templateUid,
						sectionId: option.value,
					}}
					activeOptions={{
						exact: true,
					}}
					activeProps={{
						"data-ui-selected": true,
					}}
					className={sectionLinkClassName}
				>
					<ShortcutLabel
						label={option.label}
						shortcut={option.shortcut}
					/>
				</LinkButtonLink>
			))}
		</EditorSectionBar>
	);
};
