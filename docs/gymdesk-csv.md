# Get your training CSV from Gymdesk

Export your attendance history, then import it into Mat Metrics.

## 1. Log in to your Gymdesk

Open your gym's own Gymdesk website and sign in to your member account. Use the account whose training history you want to export.

## 2. Open all your trainings

Go to your attendance or training history page, where your past sessions appear in a table. The usual address ends in `/members/attendance`. Choose **All trainings** or **All ranks** if your gym offers that filter. Stay on this page for the next step.

## 3. Open the browser console

Open Developer Tools with **F12** or **Ctrl + Shift + J** in Chrome or Edge on Windows. On a Mac, use **Command + Option + J**. Select the **Console** tab.

## 4. Copy and run the export script

Click **Copy script** below, paste the script into the Gymdesk console, and press **Enter**. You can also open the project's `gymdesk-scrape.js` file and copy its entire contents. Run it on your Gymdesk attendance page, where you are already logged in.

The script reads each page of attendance, removes exact duplicate rows, and downloads `gymdesk-all-attendance.csv`. Watch the console for progress messages and the final exported-record count. Keep the tab open until it finishes.

## 5. Import your CSV

Return to Mat Metrics and click **Import CSV**, or drag `gymdesk-all-attendance.csv` onto the app. Your charts will update with your training history.

Your imported records and filename are saved only in this browser's local storage, so they stay available after a refresh. Mat Metrics does not send the CSV to a server. Use the **Remove CSV** control next to the filename in the top bar to delete the saved copy. Clearing this site's browser data also removes it; private browsing can clear it when the private session ends.

## If something goes wrong

If pasting is blocked, review the script before following your browser's console instructions. The script uses your current Gymdesk login to read attendance and create a local CSV download.

If the CSV is empty, check that you are on your attendance page and that training rows are visible. If the console reports a request failure or an HTTP error, the download may contain only the pages fetched before the error; sign in again and rerun the export.

Different gyms can customize their Gymdesk pages. This script expects an attendance table with training names in the first column and date, time, and duration in the second column.
