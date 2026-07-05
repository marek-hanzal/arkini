# 2026-07-05 — line input/output flow UI

- flipped producer line detail resource flow from `Outputs -> Inputs` to `Inputs -> Outputs`
- added a compact centered down arrow between resource inputs and outputs when both sections are visible
- added an `Inputs` section header so the top-down flow reads as required resources first, produced resources second
- kept effect requirements / limits above the resource flow
- added regression coverage for rendered order: inputs, source item, arrow, outputs, result item
