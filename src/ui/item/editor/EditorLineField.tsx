import type { EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { Button } from "~/ui/button/Button";
import { EditorItemDraftDefaults } from "~/ui/item/editor/EditorItemDraftDefaults";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { withFieldGroup } from "~/ui/form/EditorForm";
import { EditorLineInputsControl } from "~/ui/item/editor/EditorLineInputsControl";
import { EditorOutputControl } from "~/ui/item/editor/EditorOutputControl";
import { EditorRulesControl } from "~/ui/item/editor/EditorRulesControl";

const defaultLine: EditorLine = {
	id: "",
	title: "",
	description: "",
	default: false,
	show: true,
	enable: true,
	runtimeMs: 0,
	input: [
		{
			type: "simple",
		},
	],
	rules: [],
};

/** Edits one line through registered leaf fields while preserving authored rules. */
export const EditorLineFields = withFieldGroup({
	defaultValues: defaultLine,
	props: {
		label: undefined as string | null | undefined,
	},
	render: ({ group, label = "Product line" }) => (
		<div className="grid gap-4">
			{label === null ? null : <h3 className="text-sm font-semibold">{label}</h3>}
			<div className="grid gap-3 md:grid-cols-2">
				<group.AppField name="id">
					{(field) => <field.TextField label="Line ID" />}
				</group.AppField>
				<group.AppField name="title">
					{(field) => <field.TextField label="Line title" />}
				</group.AppField>
			</div>
			<group.AppField name="description">
				{(field) => (
					<field.TextAreaField
						label="Line description"
						rows={3}
					/>
				)}
			</group.AppField>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<group.AppField name="runtimeMs">
					{(field) => (
						<field.NumberField
							label="Runtime (milliseconds)"
							min={0}
						/>
					)}
				</group.AppField>
				<group.AppField name="default">
					{(field) => <field.BoolSwitch label="Default line" />}
				</group.AppField>
				<group.AppField name="show">
					{(field) => <field.BoolSwitch label="Visible by default" />}
				</group.AppField>
				<group.AppField name="enable">
					{(field) => <field.BoolSwitch label="Enabled by default" />}
				</group.AppField>
			</div>
			<group.Subscribe selector={(state) => state.values.input}>
				{(input) => (
					<EditorLineInputsControl
						value={input}
						onChange={(next) => group.setFieldValue("input", next)}
					/>
				)}
			</group.Subscribe>
			<group.Subscribe selector={(state) => state.values.output}>
				{(output) => (
					<section className="grid gap-3 border-t border-line pt-4">
						{output === undefined ? (
							<EditorCapabilityStatus
								actionLabel="Enable line output"
								description="This line currently only applies its input and runtime behavior. Enable an output to emit weighted items when the job completes."
								icon="icon-[lucide--package-plus]"
								onEnable={() =>
									group.setFieldValue(
										"output",
										structuredClone(EditorItemDraftDefaults.output),
									)
								}
								title="Line output is disabled"
							/>
						) : (
							<>
								<header className="flex items-center justify-between gap-3">
									<div>
										<h3 className="text-sm font-semibold">Output</h3>
										<p className="mt-1 text-xs text-muted">
											Optional weighted sets, rolls and item drops.
										</p>
									</div>
									<Button
										onClick={() => group.setFieldValue("output", undefined)}
									>
										Disable output
									</Button>
								</header>
								<EditorOutputControl
									value={output}
									onChange={(next) => group.setFieldValue("output", next)}
								/>
							</>
						)}
					</section>
				)}
			</group.Subscribe>
			<group.Subscribe selector={(state) => state.values.rules}>
				{(rules) => (
					<EditorRulesControl
						rules={rules}
						allowedTypes={[
							"show",
							"hide",
							"enable",
							"disable",
							"runtime:multiplier",
						]}
						onChange={(next) =>
							group.setFieldValue("rules", next as EditorLine["rules"])
						}
					/>
				)}
			</group.Subscribe>
		</div>
	),
});
