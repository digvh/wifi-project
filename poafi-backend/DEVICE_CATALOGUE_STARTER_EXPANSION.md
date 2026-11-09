# Device catalogue starter expansion

This additive migration expands the initial PoaFi catalogue with commonly encountered TP-Link Omada, MikroTik, Ubiquiti UniFi, and Ruijie/Reyee models.

## Data quality

- Model names and product families are based on manufacturer portfolio pages linked in each record.
- Detailed fields are intentionally left empty until checked against exact model, hardware revision, and regional datasheet.
- Catalogue presence does not imply PoaFi management integration.
- Coverage is not guaranteed and is not inferred from model family.
- Migration is idempotent for existing brand/model pairs (`ON CONFLICT DO NOTHING`).

## Sources

- TP-Link Omada: https://www.omadanetworks.com/uk/omada-mesh/product-list/ and https://www.omadanetworks.com/us/omada-mesh/product-list/
- TP-Link compatibility: https://www.omadanetworks.com/sg/omada_compatibility_list/
- MikroTik: https://mikrotik.com/products/group/indoor-wireless
- Ubiquiti: https://www.ui.com/wifi and https://www.ui.com/wifi/outdoor
- Ruijie/Reyee: https://reyee.ruijie.com/en-global/products/reyee-wireless/

## Apply locally

From `poafi-backend` run:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
```

Review the catalogue in the Super Admin dashboard after applying the migration. Confirm CI and disposable-database migration tests before production deployment.
