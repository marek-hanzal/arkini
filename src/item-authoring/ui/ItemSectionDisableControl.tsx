import { useStore } from "@tanstack/react-form";
import { PowerOff } from "lucide-react";

import type { OptionalCapability, SectionId } from "~/item-authoring/type/Section";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Tooltip } from "~/ui/ui/Tooltip";

const CapabilityDescription: Record<OptionalCapability, string> = {
	production: "Disable removes all production lines from this item.",
	merges: "Disable removes all merge interactions from this item.",
	clock: "Disable removes timing, rules and expiry output from this item.",
	units: "Disable removes the unit supply and depletion output from this item.",
	action: "Disable removes this action, its rules and input requirements. It does not restore removed production lines or Clock.",
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
			case "action":
				return values.action !== undefined;
			default:
				return false;
		}
	});
	if (
		!configured ||
		(sectionId !== "production" &&
			sectionId !== "merges" &&
			sectionId !== "clock" &&
			sectionId !== "units" &&
			sectionId !== "action")
	)
		return null;
	return (
		<Tooltip
			content={
				<div className="grid gap-2">
					<p>{translator.textFn(CapabilityDescription[sectionId])}</p>
					<p>
						{translator.textFn(
							"This changes only the current form. Save applies it; Discard restores the saved item.",
						)}
					</p>
				</div>
			}
		>
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
						case "action":
							form.setFieldValue("action", undefined);
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
