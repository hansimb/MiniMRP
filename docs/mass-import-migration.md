# Mass Import Migration

This migration format is used to create the initial master component library, seller links, and inventory records in MiniMRP.

Products, versions, and BOM references are created by UI and imported separately, so this file only covers component master data, seller data, and inventory data.

## Required Columns

```text
component_sku
component_name
component_category
component_producer
component_value
component_safety_stock
inventory_quantity_available
inventory_purchase_price
seller_name
seller_base_url
seller_lead_time_days
seller_product_url
```

## What This Import Creates

- `components` master records
- `inventory` records for each component
- `sellers` records
- `component_sellers` links between components and sellers

## Notes

- Use one row per component and seller combination.
- If a component has multiple sellers, create multiple rows for that component.
- `seller_product_url` is the direct product page for that component at that seller.
- This import is intended for the first-time master data and inventory migration.
