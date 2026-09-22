import { useStore } from "@tanstack/react-form";
import { PowerOff } from "lucide-react";

import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Tooltip } from "~/ui/ui/Tooltip";
import { Mx } from "~/translation/ui/Mx";

const CapabilityHelp = ({ capability }: { readonly capability: OptionalCapability }) => {
	switch (capability) {
		case "production":
			return <Mx label="Disable production help" />;
		case "merges":
			return <Mx label="Disable merges help" />;
		case "clock":
			return <Mx label="Disable Clock help" />;
		case "units":
			return <Mx label="Disable Units help" />;
	}
};

/** Clears only the active capability in the local form; the form session owns persistence. */
export const ItemSectionDisableControl = ({ sectionId }: { readonly sectionId: SectionId }) => {
	const { form, isSaving } = useFormSession();
	const translator = useTranslator();
	const configured = useStore(form.store, ({ values }) => {
		switch (sectionId) {
			case "production":
				return (values.lines?.length ?? 0) > 0;
			case "merges":
				return (values.merge?.length ?? 0) > 0;
			case "clock":
				return values.clock !== undefined;
			case "units":
				return values.units !== undefined;
			default:
				return false;
		}
	});
	if (
		!configured ||
		(sectionId !== "production" &&
			sectionId !== "merges" &&
			sectionId !== "clock" &&
			sectionId !== "units")
	)
		return null;
	return (
		<Tooltip content={<CapabilityHelp capability={sectionId} />}>
			<LinkButton
				className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
				data-ui="ItemSectionDisableControl"
				disabled={isSaving}
				onClick={() => {
					switch (sectionId) {
						case "production":
							form.setFieldValue("lines", []);
							break;
						case "merges":
							form.setFieldValue("merge", undefined);
							break;
						case "clock":
							form.setFieldValue("clock", undefined);
							break;
						case "units":
							form.setFieldValue("units", undefined);
							break;
					}
				}}
			>
				<PowerOff className="size-4" />
				{translator.textFn("Disable")}
			</LinkButton>
		</Tooltip>
	);
};
