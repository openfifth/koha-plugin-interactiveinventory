# Future Enhancements - Interactive Inventory Plugin

Tracked from feedback 3/6/26. These are out of scope for current bug-fix cycle.

## Could Fix (Nice-to-have)

1. **Dashboard sort by scan order** - Staff want to sort Dashboard by the order items were scanned, so they can find their place when resuming an interrupted session. Possible proxy: sort by `datelastseen` (updated at scan time).

2. **Dashboard dismiss by clicking outside** - Currently requires clicking the X button. Would be nice to close by clicking the overlay backdrop.

3. **Misleading transfer message after check-in** - When a checked-out item is checked in and triggers a return-to-home transfer, the message says "Please initiate the transfer process" but Koha has already created the transfer. Message should reflect that the transfer was auto-initiated.

4. **Loading messages slightly confusing with "skip checked-out" enabled** - When skip checked-out is enabled, loading shows "Starting with 321 items" then "Expected items 214" which is correct but confusing. Could clarify that the reduction is due to filtering out checked-out items.

## Would Fix (Low priority UX)

5. **Resolution modal radio buttons not fully clickable** - On the setup form, the full div area for checkbox/radio selections is clickable. But on resolution modals (lost, checkout, return claims, transit, withdrawn), the `.option` divs are not wrapped in `<label>` elements, so only the radio button and its text label are clickable, not the full div area.

## Previously Noted / Deferred

6. **"Soft" status filters** - Still update last-seen for skipped items rather than ignoring them entirely. (From previous feedback cycle, not yet implemented.)

7. **Restructure "Do not check in items" checkbox** - Confusingly phrased, might belong in status resolution section rather than parameters. (From previous feedback cycle.)
