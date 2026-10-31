# PoaFi Device Catalogue: Super Admin Data Collection Guide

This guide explains how to complete catalogue records accurately. The goal is a broad multi-brand catalogue with trustworthy specifications, not invented values.

## 1. Where to find the values

Use this source order for every exact model and hardware revision:

1. Manufacturer product page for the exact model.
2. Manufacturer datasheet PDF for the exact model and revision.
3. Manufacturer support/download page for the exact hardware revision and region.
4. Manufacturer installation guide or user manual for PoE, IP rating, ports, antenna and operating environment.
5. Manufacturer compatibility/controller documentation for management platform and supported features.

Do not use reseller listings, marketplace descriptions, forum posts or another model's datasheet as the authoritative source. If the manufacturer does not publish a value, record it as `Not published` in a text note or leave the numeric field unset with a clear note; never enter zero as a substitute.

## 2. Manufacturer documentation starting points

- TP-Link Omada support and datasheets: https://support.omadanetworks.com/ . Search the exact model, then choose the matching hardware version and region. TP-Link warns that model and hardware-version availability can vary by region.
- MikroTik product pages and product catalogue: https://mikrotik.com/products . Open the exact product and its specifications; use RouterOS documentation for management/API capability: https://help.mikrotik.com/docs/ .
- Ubiquiti product pages and downloads: https://www.ui.com/wifi and https://techspecs.ui.com/ . Select the exact UniFi/airMAX model and check its technical specifications and downloads.
- Ruijie/Reyee wireless product catalogue: https://www.ruijie.com/en-global/products/wireless-listing and https://reyee.ruijie.com/ . Check exact suffixes such as E/G/OD and exact product generation.
- Grandstream product pages and documentation: https://www.grandstream.com/products/networking-solutions . Use the model-specific datasheet/manual.
- Cisco wireless datasheets: https://www.cisco.com/ . Search the exact Catalyst/Meraki model and datasheet; distinguish Catalyst from Meraki management.
- HPE Aruba product pages and support: https://www.arubanetworks.com/ . Check Instant On versus enterprise Aruba product families separately.
- Cambium Networks products and support: https://www.cambiumnetworks.com/ . Check cnPilot, XV/XE, ePMP and PMP families separately.
- Huawei Enterprise support/product pages: https://e.huawei.com/ . Check the exact eKitEngine/AP model and region.
- Tenda product and support pages: https://www.tendacn.com/ . Search exact model and region.

## 3. How to complete each catalogue field

| Catalogue field | Where to find it | How to enter it |
|---|---|---|
| Brand | Product label and manufacturer page | Official brand name, consistently spelled |
| Model | Product label, datasheet title | Exact model including suffix; do not merge similar variants |
| Category | Product role in datasheet | Router, access point, wireless CPE, mesh, switch, gateway, controller or extender |
| Subcategory | Product page / installation guide | Ceiling, wall, outdoor, point-to-point, PoE switch, etc. |
| Environment | IP rating and installation guide | Indoor, outdoor, or both only when the manufacturer supports it |
| Coverage metres | Datasheet only | Enter only a manufacturer-published distance in metres; do not convert an area figure (m²) into metres |
| Coverage note | Datasheet footnotes | State whether it is a maximum, per-band value, area, or conditional figure |
| Frequency bands | Wireless specifications | Enter supported bands exactly, e.g. 2.4 GHz, 5 GHz, 6 GHz |
| Wi-Fi standard | Wireless specifications | Wi-Fi 4/5/6/6E/7 or IEEE 802.11 versions as documented |
| Max clients | Datasheet | Enter only the documented associated/concurrent client figure; distinguish recommended from maximum |
| Max speed Mbps | Datasheet | State the figure's meaning in notes (aggregate PHY rate, per-radio rate, or wired port rate); do not treat it as user throughput |
| Antenna | Radio/antenna specifications | Internal/external, number of antennas, gain and directionality when available |
| PoE | Power specifications | Exact standard (802.3af/at/bt), passive voltage, or DC adapter; do not assume PoE compatibility |
| IP rating | Environmental specifications | Exact rating such as IP54/IP65/IP67; leave not applicable for indoor models if no rating is stated |
| Management platform | Manufacturer management guide | Exact platform (e.g. RouterOS, Omada SDN, UniFi Network, Reyee Cloud, GWN.Cloud); this is not proof PoaFi integration exists |
| Hotspot support | Official feature/API documentation and lab test | Mark true only when the device supports the required captive portal/hotspot workflow; distinguish native hotspot from PoaFi integration |
| Source URL | Exact product/datasheet page | Direct official URL for the model/revision, not a general brand homepage if a model page exists |
| Notes | Datasheet footnotes / validation | Hardware revision, region, max-vs-recommended caveats, discontinued status and test notes |

## 4. Important distinctions

- A router, access point, wireless CPE, controller and switch are different device categories. Do not classify every Wi-Fi device as a router.
- Wi-Fi advertised link speed is not guaranteed internet speed or real-world throughput.
- Coverage in metres and coverage in square metres are different measurements. Do not put square metres in `coverageMeters`.
- Maximum clients and recommended clients are not interchangeable.
- A device supporting a controller does not automatically mean PoaFi has an integration for that controller.
- Hardware revisions, regional radio rules, power supplies and firmware can change specifications. Store a separate catalogue record when the variant is materially different.
- Never store device passwords, API tokens, controller passwords or customer credentials in the public catalogue.

## 5. Super Admin collection workflow

For each model:

1. Read the exact model printed on the device label or product packaging.
2. Open the manufacturer's official product/support page.
3. Confirm hardware revision and region. If you do not have a physical device, use the intended market/region and state that in Notes.
4. Download the model datasheet and installation guide.
5. Fill all applicable fields using the table above.
6. For a value not published by the manufacturer, write `Not published` in Notes; for a field that does not apply, write `Not applicable` in Notes. Keep numeric fields empty rather than entering a false zero until the catalogue UI supports explicit unknown/not-applicable statuses.
7. Save the official source URL and review the record before publishing it to operators.
8. Only mark hotspot support after checking official documentation and testing the required workflow with that exact model/firmware.

## 6. Suggested rollout order

Prioritize equipment actually used by PoaFi operators and customers. Start with TP-Link Omada, MikroTik RouterOS, Ubiquiti UniFi/airMAX, Ruijie/Reyee, Grandstream, then add HPE Aruba, Cisco/Meraki, Cambium, Huawei and Tenda. This is a practical starting list, not an exhaustive list of every manufacturer or model worldwide.

## 7. Before production

- Verify each record against the exact manufacturer's datasheet and revision.
- Remove duplicate or discontinued variants unless intentionally retained for existing installations.
- Test migration and catalogue CRUD on a staging database.
- Test operator selection separately from device connection and management.
- Build and test an integration adapter for each device family before describing it as managed by PoaFi.
