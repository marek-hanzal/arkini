import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { Button } from "~/ui/button/Button";
import { EditorCapabilityStatus } from "~/ui/form/EditorCapabilityStatus";
import { withFieldGroup } from "~/ui/form/EditorForm";

const defaultArtwork: EditorItem["asset"] = {
	default: [
		"",
	],
	sources: [],
};

/** Owns the complete artwork subtree through TanStack's registered field-group API. */
export const EditorItemArtworkFields = withFieldGroup({
	defaultValues: defaultArtwork,
	render: ({ group }) => (
		<>
			<group.AppField name="default[0]">
				{(field) => <field.AssetField label="Base asset" />}
			</group.AppField>
			<group.Subscribe selector={(state) => state.values.default}>
				{(assets) =>
					assets[1] === undefined ? (
						<EditorCapabilityStatus
							actionLabel="Enable composite artwork"
							description="Composite artwork overlays a second asset on the base image, using the same two-layer presentation wherever this item is rendered."
							icon="icon-[lucide--layers-2]"
							onEnable={() =>
								group.setFieldValue("default", [
									assets[0],
									"",
								])
							}
							title="Composite artwork is disabled"
						/>
					) : (
						<div className="grid gap-3">
							<group.AppField name="default[1]">
								{(field) => <field.AssetField label="Overlay asset" />}
							</group.AppField>
							<Button
								className="justify-self-start"
								onClick={() =>
									group.setFieldValue("default", [
										assets[0],
									])
								}
							>
								Remove composite layer
							</Button>
						</div>
					)
				}
			</group.Subscribe>
			<group.AppField
				name="sources"
				mode="array"
			>
				{(sourcesField) => {
					const sources = sourcesField.state.value ?? [];
					return (
						<div className="grid gap-3 border-t border-line pt-4">
							{sources.length === 0 ? (
								<EditorCapabilityStatus
									actionLabel="Enable progress artwork"
									description="Progress artwork adds ordered visual states after the default composition so the item can change appearance as its runtime state advances."
									icon="icon-[lucide--gallery-horizontal-end]"
									onEnable={() => sourcesField.pushValue("")}
									title="Progress artwork is disabled"
								/>
							) : (
								<>
									<div className="flex items-center justify-between gap-3">
										<div>
											<h3 className="text-sm font-semibold">
												Progress assets
											</h3>
											<p className="mt-1 text-xs text-muted">
												Ordered single-image states shown after the default
												composition.
											</p>
										</div>
										<Button onClick={() => sourcesField.pushValue("")}>
											Add progress asset
										</Button>
									</div>
									{sources.map((_, index) => (
										<div
											key={`${index}`}
											className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]"
										>
											<group.AppField name={`sources[${index}]`}>
												{(field) => (
													<field.AssetField
														label={`Progress asset ${index + 1}`}
													/>
												)}
											</group.AppField>
											<Button
												className="self-end"
												onClick={() => sourcesField.removeValue(index)}
											>
												Remove
											</Button>
										</div>
									))}
								</>
							)}
						</div>
					);
				}}
			</group.AppField>
		</>
	),
});
