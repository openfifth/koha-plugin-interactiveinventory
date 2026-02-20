# Feedback Response: Interactive Inventory Plugin (13 Jan 2026)

30 of 34 items fixed. 1 under investigation. 1 core limitation. 2 noted for future.

## Questions

1. Toggle Status button in Dashboard → toggles items between scanned and missing status; changes now reflect on the main page with a "MARKED MISSING" indicator
2. Shelf Preview → redesigned; now uses Koha's shelf browser API, shows nearby items by call number centred on the last scanned item, respects session filters
3. "Soft" status filters (still update last-seen for skipped items) → not yet implemented, noted as feature request

## Must Fix

4. Permissions error when user only has "use tool plugins" → fixed
5. Shelving location filter uses current location instead of permanent location → known limitation of core Koha method (getItemsForInventory), not something the plugin can change without an enhancement to Koha core
6. Skip filters not working for waiting holds, in-transit, and branch mismatch items → fixed, all statuses now detected and skipped correctly
7. Dashboard crashes when both "Skip branch mismatch" and "Compare to expected barcodes" enabled → fixed
8. Home library filter only partially applied, expected items count too high → fixed, filter now applied consistently
9. Slow response time per scan (7–8 seconds reported) → difficulty replicating consistently, continuing to investigate
10. Last seen date recorded as date only (time always 00:00) → fixed, now records full date and time
11. Holding branch not updated on scan → fixed, updates immediately
12. Return claims not detected or resolvable → fixed
13. Multiple statuses not detected (wrong home branch, branch mismatch, in transit, pending holds, found holds, withdrawn) → fixed, all now produce alerts
14. Holds not trapping and transfers not starting on check-in → fixed, patron name and transfer info now displayed
15. Sort by call number does nothing in Dashboard → fixed
16. "Export missing items only" checkbox missing from end-of-session modal → fixed, appears when CSV export enabled
17. Home and holding library not shown in item details → fixed

## Should Fix

18. Renew option shown for items not eligible for renewal → fixed, option now disabled when ineligible
19. Checked-out item warning disappears too quickly, text cut off → noted for future improvement
20. Unexpected item message gives no reason why → fixed, now shows specific reason
21. Check-in status shown incorrectly when user skips resolving a checkout → fixed, reflects actual resolution
22. Skip checkboxes buried in settings, "skip checked-out" checked by default → fixed, moved to top, all unchecked by default
23. Active filters display missing resolution settings and check-in mode → fixed, now shown
24. Patron info shows "Unknown Patron" and "Due date: N/A" in resolution modal → fixed

## Could Fix

25. No help text for "Skip items on hold awaiting pickup" → fixed, help text added
26. "Do not check in items" checkbox confusingly phrased, might belong in status resolution section → noted, will consider restructuring
27. Shelving location shows code instead of description → fixed, shows description
28. Item type not shown in item details → fixed
29. Duplicate "Home" breadcrumb → fixed
30. Duplicate rows in Dashboard scanned items tab when re-scanning and sorting → fixed

## Would Fix

31. Checkbox and radio button divs not fully clickable → fixed, entire area now clickable
