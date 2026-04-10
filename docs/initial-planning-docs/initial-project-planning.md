# MiniMRP - Initial Project Planning

## 1. Project Overview

MiniMRP is a lightweight internal MRP system for Spectrum Audio Instruments (SAI), built to support the practical day-to-day needs of a small manufacturer handling electronic products, components, BOMs, and inventory.

The purpose of the system is to make internal material and product data easier to manage, reduce manual spreadsheet work, and improve visibility into what is needed for production.

#### Design Philosophy

MiniMRP will be built as a tailored internal tool for one real business use case. The system should stay simple, maintainable, and focused on the actual workflow: managing products, versions, components, suppliers, inventory, attachments, and Excel-based bulk data updates.

## 2. Goals

- Simple and practical internal back-office for SAI
- Reduce manual work in BOM, component, and inventory management

## 3. Architecture

- **Front-end:** Next.js admin UI
- **Back-end:** Supabase as the initial implementation
- **Data storage:** Fixed relational schema based on the current SAI workflow and data model
- **Structure:** Simple project structure with clear separation between UI, data access, and business logic, without unnecessary abstraction
- **Deployment:** Cloud-hosted web app, with local development kept straightforward

## 4. Features

- Product and version management
- BOM management by product version
- Component master and supplier data management
- Inventory tracking
- Attachments for product versions such as CAD, schematic, or other files
- Excel import/export for bulk updates
- Basic cost visibility and lead time-aware purchasing / production planning

## 5. Future Considerations

- Better reporting for purchasing and production planning
- Tighter integration with other internal tools or commerce data if needed
- Additional features added only when real business need is confirmed
