# 2026-06-23 item sheet icons + producer layout pass

## Scope
- Add item/resource icons across item detail UI wherever item assets are available.
- Improve producer product line layout to keep produced item names readable and keep main controls on one line.
- Adjust summary card hero layout to enlarge the item art and keep title/store action on one row.

## Main changes
- Added reusable `ItemInlineAsset` and `ItemInlineAssetGroup` primitives.
- Updated producer product lines card:
  - full wrapped product names
  - requirements, hindrances, and inputs show item icons
  - input rows show icons + text/meta + withdraw button
  - control row is now `[start/action 2/3] [default/un-default 1/3]`
- Updated requirement rules card to show icons for exclusive rules, requirements, and inputs.
- Updated craft card to show the crafted result icon and icons in craft input rows.
- Updated relation list to show icons on both sides of the relation.
- Updated summary card layout to enlarge the main item art and place title/store on one line with description below.
- Increased detail sheet content max width from 460px to 520px.
