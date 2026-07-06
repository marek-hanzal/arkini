# 2026-07-06 — game validator report pass

- added `auditGameConfigReport` as the structured validator/audit document model
- validator now supports `-v` / `--verbose` and prints summary counts plus limited-deposit wiring details
- limited deposit report shows max capacity, depletion behavior, spending lines, stochastic risk lines, and sustainable replacement status
- added `limited-deposit-stochastic-softlock` warning for finite deposits spent by producer lines with no guaranteed output
- kept schema/validation failures as the hard error / non-zero return-code path; audit warnings stay warning-level output
- covered stochastic finite-capacity spend and verbose report formatting in `cli/game/auditGameConfig.test.ts`
