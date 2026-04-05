# MiniMRP - Initial UI and Implementation Plan

## 1. Purpose

This document defines the first implementation plan for the MiniMRP application for Spectrum Audio Instruments (SAI).

The goal is to guide an AI agent or developer to build the first usable version of the system as a simple, internal, production-oriented tool. The plan should also work as a general design document for the project.

The application should not be treated as a generic platform. It should be implemented for the actual SAI workflow described in the current project plan and data schema documents.

## 2. Implementation Direction

- Build a minimal and practical internal admin application
- Use Supabase as the backend from the beginning
- Keep the project structure simple
- Keep UI code data-agnostic and separate from data access logic
- Avoid unnecessary framework or architecture complexity
- Prioritize clarity, maintainability, and fast iteration

## 3. Application Structure

Recommended structure:

- `app/` for routes and page composition
- `components/` for reusable UI building blocks
- `features/` for product, version, component, inventory, and import related UI sections
- `lib/supabase/` for Supabase clients and queries
- `lib/mappers/` for mapping database data into UI-friendly shapes
- `lib/import/` for CSV / Excel parsing and import transformation logic

This is a simple clean structure, not a heavy abstraction model. UI must not directly contain raw database logic.

## 4. Main Views

### Products View

- Show all products in a simple list or grid
- Each product opens to a product detail page
- Product detail page shows:
  - product name
  - image
  - essential product information
  - list of versions

### Version View

- Each version opens to its own detail page
- Version page shows:
  - version identifier
  - attachments
  - important version-specific details
  - BOM related actions
- Version page must include import button for CSV / Excel BOM import
- Import flow must support user-defined source structure that is mapped into the system format

### Components View

- Show all components in one view
- Support filtering and categorization
- Show essential information from schema
- Include import and export actions
- Export must follow active filters
- Include add component action
- Allow deleting components
- Each component opens to its own detail page

### Inventory View

- Show all inventory rows with essential information
- Include import and export actions
- Keep structure simple and optimized for daily use

## 5. UX Direction

- Minimal, calm, and fast to use
- Prioritize readability over visual complexity
- Make list views efficient for internal work
- Make detail pages clear and predictable
- Prefer simple tables, sections, drawers, and dialogs over complicated dashboards

## 6. Data and Backend Rules

- Use the schema defined in `initial-data-schema-planning.md`
- Use Supabase relational tables directly
- Keep queries centralized
- Map imported files into database-compatible shape before insert / update
- Prefer explicit tables and fields over dynamic schema systems
- Add indexes for foreign keys and frequently filtered fields

## 7. First Implementation Scope

The first implementation should include:

- Supabase schema SQL
- Product list and product detail pages
- Version detail page
- Component list and component detail page
- Inventory list page
- Attachment listing for versions
- CSV / Excel import entry points for BOM, components, and inventory
- Filtered export for components and inventory

## 8. Out of Scope for First Version

- Generic schema builder
- Multi-tenant architecture
- Plugin-style extensibility
- Overly abstract domain framework
- Features not directly tied to current SAI workflow
