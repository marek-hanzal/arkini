# 2026-07-06 — cracked rock deposit placeholder

- processed generated mined-out rock crack art into `128x128` RGBA PNG with transparent background
- added `game/arkini/assets/item-cracked-rock.png`
- added passive board-only `item:cracked-rock` to Era I config
- changed `item:rock` depletion from remove to replace with `item:cracked-rock`
- gameplay hook is intentionally passive for now; renewal/use will be designed next
- `limited-deposit-softlock` warning for `item:rock` remains expected until cracked-rock gains a sustainable renewal path
