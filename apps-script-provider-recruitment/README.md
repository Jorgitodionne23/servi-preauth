# Provider Recruitment Apps Script (mirror)

Paste `ProviderRecruitment.gs` into a container-bound Apps Script attached to your provider spreadsheet. The script adds a menu **Provider Recruitment → Generate Provider ID for verified provider** that:
- Ensures the active row is a verified provider (`Status` column matches `Verified`/`Verificado`).
- Generates a unique ID like `prov-1a2b3c4d` and writes it to the `Provider ID` column.
- Notes who generated it and when.

Adjust constants at the top of `ProviderRecruitment.gs` if your sheet uses different column labels or statuses. Leave `PROVIDER_SHEET_NAME` blank to use the active tab, or set it (e.g., `'Provider Recruitment'`) to lock to a specific sheet name. IDs are sequential (`prov-000001`…) and unique across all tabs in the file; the script checks every sheet before issuing a new ID. When an ID is issued, the `Status` cell is set to `Verified` (green). There is also a menu action to mark a provider as `Removed` (red) without deleting any other data.
