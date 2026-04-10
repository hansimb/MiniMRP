# Initial data schema planning

For spectrum audio instruments as an example:

## Product

| Field | Type   | Notes            |
| ----- | ------ | ---------------- |
| id    | UUID   | Primary key      |
| name  | STRING | Product name     |
| image | STRING | File path or URL |

---

## Version

| Field          | Type          | Notes                        |
| -------------- | ------------- | ---------------------------- |
| id             | UUID          | Primary key                  |
| product_id     | FK Product.id | Reference to Product         |
| version_number | STRING        | Version identifier (e.g. v1) |

---

## ComponentMaster

| Field    | Type   | Notes                    |
| -------- | ------ | ------------------------ |
| id       | UUID   | Primary key              |
| name     | STRING | Component name           |
| category | STRING | e.g. Resistor, Capacitor |
| producer | STRING | Manufacturer             |
| value    | STRING | e.g. 10k, 100nF          |

---

## Seller

| Field     | Type   | Notes                               |
| --------- | ------ | ----------------------------------- |
| id        | UUID   | Primary key                         |
| name      | STRING | Seller name                         |
| base_url  | STRING | Base URL for link generation        |
| lead_time | NUMBER | Lead time (same for all components) |

---

## ComponentSeller

| Field        | Type                  | Notes                           |
| ------------ | --------------------- | ------------------------------- |
| component_id | FK ComponentMaster.id | Reference to component          |
| seller_id    | FK Seller.id          | Reference to seller             |
| product_url  | STRING                | Generated or stored product URL |

Primary Key: (component_id, seller_id)

---

## ComponentReference

| Field               | Type                  | Notes                                     |
| ------------------- | --------------------- | ----------------------------------------- |
| version_id          | FK Version.id         | Reference to the version                  |
| component_master_id | FK ComponentMaster.id | Reference to the component master         |
| reference           | STRING                | Circuit board reference, e.g., R1, C3, U5 |

Primary Key: (version_id, reference)

---

## Inventory

| Field              | Type                  | Notes                          |
| ------------------ | --------------------- | ------------------------------ |
| id                 | UUID                  | Primary key                    |
| component_id       | FK ComponentMaster.id | Reference to component         |
| quantity_available | NUMBER                | Current stock level            |
| purchase_price     | NUMBER                | Last or average purchase price |

---

## Attachment

| Field      | Type          | Notes                    |
| ---------- | ------------- | ------------------------ |
| id         | UUID          | Primary key              |
| version_id | FK Version.id | Reference to the version |
| file_path  | STRING        | File path or URL         |

---

## Relationships

- Product (1) → (many) Version
- Version (1) → (many) Attachment
- Version (1) → (many) ComponentReference
- ComponentReference (many) → (1) ComponentMaster
- ComponentMaster (many) → (many) Seller (via ComponentSeller)
- ComponentMaster (1) → (1) Inventory
