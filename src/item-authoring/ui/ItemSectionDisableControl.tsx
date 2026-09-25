import { match } from "ts-pattern";
import { useStore } from "@tanstack/react-form";
import { PowerOff } from "lucide-react";

import type { OptionalCapability } from "~/item-authoring/type/Section";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Tooltip } from "~/ui/ui/Tooltip";
import { Mx } from "~/translation/ui/Mx";

type DisableCapability = Exclude<OptionalCapability, "units">;

const CapabilityHelp = ({ capability }: { readonly capability: DisableCapability }) => {
	return match(capability)
		.with("production", () => {
			return <Mx label="Disable production help" />;
		})
		.with("merges", () => {
			return <Mx label="Disable merges help" />;
		})
		.with("clock", () => {
			return <Mx label="Disable Clock help" />;
		})
		.exhaustive();
};

/** Clears only the named capability in the local form; the form session owns persistence. */
export const ItemSectionDisableControl = ({
	capability,
}: {
	readonly capability: DisableCapability;
}) => {
	const { form, isSaving } = useFormSession();
	const translator = useTranslator();
	const configured = useStore(form.store, ({ values }) => {
		return match(capability)
			.with("production", () => {
				return values.lines?.some((line) => line.trigger === "manual") ?? false;
			})
			.with("merges", () => {
				return (values.merge?.length ?? 0) > 0;
			})
			.with("clock", () => {
				return (
					values.clock !== undefined ||
					(values.lines?.some((line) => line.trigger === "clock-interval") ?? false)
				);
			})
			.exhaustive();
	});
	if (!configured) return null;
	return (
		<Tooltip content={<CapabilityHelp capability={capability} />}>
			<LinkButton
				className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
				data-ui="ItemSectionDisableControl"
				disabled={isSaving}
				onClick={() => {
					match(capability)
						.with("production", () => {
							form.setFieldValue(
								"lines",
								(form.state.values.lines ?? []).filter(
									(line) => line.trigger !== "manual",
								),
							);
						})
						.with("merges", () => {
							form.setFieldValue("merge", undefined);
						})
						.with("clock", () => {
							form.setFieldValue("clock", undefined);
							form.setFieldValue(
								"lines",
								(form.state.values.lines ?? []).filter(
									(line) => line.trigger !== "clock-interval",
								),
							);
						})
						.exhaustive();
				}}
			>
				<PowerOff className="size-4" />
				{translator.textFn("Disable")}
			</LinkButton>
		</Tooltip>
	);
};
