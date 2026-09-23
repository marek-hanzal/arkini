import { expect, it } from "vitest";
import { compileAcquisitionRootsFn } from "~/flow/fn/compileAcquisitionRootsFn";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";

it("counts reused template inventory once per assigned space and ignores unassigned templates", () => {
	const initial = editorTestConfig.templates![0]!;
	const config = {
		...editorTestConfig,
		templates: [
			initial,
			{
				...initial,
				uid: "unused",
				board: [
					...initial.board,
					{
						itemUid: "water",
						x: 1,
						y: 1,
					},
				],
			},
		],
		start: {
			currentSpace: 0,
			spaces: [
				{
					space: 0,
					templateUid: initial.uid,
				},
				{
					space: 8,
					templateUid: initial.uid,
				},
			],
		},
	};
	expect(compileAcquisitionRootsFn(config).roots).toEqual([
		{
			factId: "water",
			quantity: 2,
		},
	]);
});
