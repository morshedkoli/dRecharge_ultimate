# UI Modernization Migration Guide

This guide outlines the steps required to migrate the rest of the dRecharge admin dashboard from the legacy UI patterns to the new atomic component library and minimalistic design tokens.

## 1. Design Tokens to Use

We have introduced standard Tailwind tokens to enforce a minimalistic, dense UI. Please adhere to these when refactoring other pages:

*   **Colors:**
    *   Primary: `bg-primary`, `text-primary` (`#134235`)
    *   Muted/Backgrounds: `bg-surface-container`, `bg-surface`
    *   Text: `text-on-surface`, `text-on-surface-variant`
*   **Typography:**
    *   Use `font-headline` for titles and `font-body` or `font-manrope` for data.
    *   Do not use arbitrary font sizes. Stick to the Tailwind standard scale (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`).
*   **Spacing & Grid:**
    *   Use multiples of 4px/8px (e.g., `gap-2`, `p-4`, `m-6`). Avoid custom pixel values like `mb-[18px]`.

## 2. Component Migration Strategy

The following components should be swapped in existing pages:

### Buttons
**Legacy:** `<button className="bg-primary text-white px-6 py-3 rounded-xl...">`
**New:** `<Button variant="default">Action</Button>`
*Variants available:* `default`, `outline`, `ghost`, `link`.

### Inputs
**Legacy:** `<input className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3..." />`
**New:** `<Input placeholder="..." />`

### Cards
**Legacy:** `<div className="bg-white rounded-2xl border border-black/5 premium-shadow p-8">`
**New:** 
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Tables
**Legacy:** Complex `<table>` with `px-8 py-5` and large padding.
**New:** Use the atomic `Table` components which default to `py-2` (compact rows).
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Col</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## 3. Checklist for Refactoring a Page

1.  [ ] Replace large container divs with standard `max-w-7xl mx-auto space-y-6`.
2.  [ ] Remove unnecessary explanatory subtext to reduce visual clutter.
3.  [ ] Swap raw `<button>` and `<input>` tags for `<Button>` and `<Input>`.
4.  [ ] Swap heavy dashboard cards for `<Card>` components.
5.  [ ] Convert data tables to the compact `<Table>` format.
6.  [ ] Ensure all actions in tables are moved into Kebab menus (`<MoreVertical />`) or compact icon buttons.

## 4. Next Steps
- Migrate `/admin/balance-requests` and `/admin/queue` using the `<Table>` component.
- Refactor the `<AuditLogDrawer>` to use the new Kebab menus and `<Card>` primitives.
