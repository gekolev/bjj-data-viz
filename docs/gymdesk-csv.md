# Get your training CSV from Gymdesk

Export your attendance and rank history, then import it into Mat Metrics.

## 1. Log in to your Gymdesk

Open your gym's own Gymdesk website and sign in to your member account. Use the account whose training history you want to export.

## 2. Open all your trainings

Go to your attendance or training history page, where your past sessions appear in a table. The usual address ends in `/members/attendance`. Choose **All trainings** or **All ranks** if your gym offers that filter. Stay on this page for the next step.

## 3. Open the browser console

Open Developer Tools with **F12** or **Ctrl + Shift + J** in Chrome or Edge on Windows. On a Mac, use **Command + Option + J**. Select the **Console** tab.

## 4. Copy and run the export script

Click **Copy script** below, paste the script into the Gymdesk console, and press **Enter**. You can also open the project's `gymdesk-scrape.js` file and copy its entire contents. Run it on your Gymdesk attendance page, where you are already logged in.

The script reads attendance and the `/members/ranks` table using your existing login, removes duplicate records, and downloads one dated file: `gymdesk-all-attendance-YYYY-MM-DD.csv`. Watch the console for progress messages and the final attendance and rank counts. Keep the tab open until it finishes.

## 5. Import your CSV

Return to Mat Metrics and click **Import CSV**, or drag the downloaded CSV onto the app. Training charts update with your attendance, and **Belts & stripes** on Overview and the Dev tab shows your dated rank milestones. Rank records do not count as training sessions. Older attendance-only CSVs still work.

Gymdesk rank codes such as `W-4` and `B-2` display as white belt with four stripes and blue belt with two stripes. Dates such as `03/01/2024` use day/month/year, so this is 3 January. The original rank code and table row are preserved in the CSV.

The training calendar marks promotion days, and the complete training journey shows belt-colored rank periods and promotion diamonds. The Dev calendar and seasonal wheel can color sessions by **Belt** or **Style**; their details show the belt and stripe count recorded on that date. Monthly activity also lists that year's rank milestones. Dates before the first recorded rank remain unknown. Previously exported rows with duplicated rank text such as `B-2 B-2 - BJJ` are supported without another scrape.

Your imported records and filename are saved only in this browser's local storage, so they stay available after a refresh. Mat Metrics does not send the CSV to a server. Use the **Remove CSV** control next to the filename in the top bar to delete the saved copy. Clearing this site's browser data also removes it; private browsing can clear it when the private session ends.

## If something goes wrong

If pasting is blocked, review the script before following your browser's console instructions. The script uses your current Gymdesk login to read attendance and ranks and create a local CSV download.

If the CSV is empty, check that you are on your attendance page and that training rows are visible. If the console reports a request failure or an HTTP error, the download may contain only the pages fetched before the error; sign in again and rerun the export.

Different gyms can customize their Gymdesk pages. This script expects an attendance table with training names in the first column and date, time, and duration in the second column.

The ranks scraper reads labeled columns when available, or finds rank codes and dates in the table rows. If it reports no dated ranks, check that `/members/ranks` shows your promotion history. A rank-page failure still downloads any attendance and ranks fetched so far; check the console counts before importing. Rank records with missing names or invalid dates are skipped by the app and reported in the import message.
