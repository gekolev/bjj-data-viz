(async () => {
    const BASE_URL = new URL("/members/attendance", window.location.origin).href;
    const allRows = [];
    const seenPages = new Set();

    function extractRowsFromDocument(doc) {
        const tables = [...doc.querySelectorAll("table")];

        if (!tables.length) {
            return [];
        }

        const table = tables.sort(
            (a, b) =>
                b.querySelectorAll("tbody tr").length -
                a.querySelectorAll("tbody tr").length
        )[0];

        return [...table.querySelectorAll("tbody tr")]
            .map(row =>
                [...row.querySelectorAll("td")].map(td =>
                    td.textContent.trim().replace(/\s+/g, " ")
                )
            )
            .filter(row => row.length >= 2);
    }

    let page = 1;

    while (true) {
        console.log(`Fetching page ${page}...`);

        const url = `${BASE_URL}?page=${page}&rank_id=0`;

        let response;

        try {
            response = await fetch(url, {
                credentials: "include"
            });
        } catch (error) {
            console.log(
                `Request failed on page ${page}. Stopping.`,
                error
            );
            break;
        }

        if (!response.ok) {
            console.log(
                `Page ${page} returned HTTP ${response.status}. Stopping.`
            );
            break;
        }

        const html = await response.text();

        const doc = new DOMParser().parseFromString(
            html,
            "text/html"
        );

        const rows = extractRowsFromDocument(doc);

        if (rows.length === 0) {
            console.log(
                `Page ${page} contains no attendance records. Reached the end.`
            );
            break;
        }

        const pageSignature = JSON.stringify(rows);
        if (seenPages.has(pageSignature)) {
            console.log(`Page ${page} repeats a previous page. Reached the end.`);
            break;
        }
        seenPages.add(pageSignature);

        console.log(
            `Page ${page}: ${rows.length} attendance records`
        );

        rows.forEach(row => {
            allRows.push({
                training: row[0] || "",
                details: row[1] || ""
            });
        });

        page++;
    }

    // Remove exact duplicates
    const uniqueRows = [
        ...new Map(
            allRows.map(row => [
                `${row.training}|${row.details}`,
                row
            ])
        ).values()
    ];

    function escapeCSV(value) {
        return `"${String(value ?? "").replace(/"/g, '""')}"`;
    }

    const csv = [
        ["Training", "Date / Time / Duration"]
            .map(escapeCSV)
            .join(","),

        ...uniqueRows.map(row =>
            [
                row.training,
                row.details
            ]
                .map(escapeCSV)
                .join(",")
        )
    ].join("\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const downloadUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "gymdesk-all-attendance.csv";

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(downloadUrl);

    console.log(
        `Finished: ${uniqueRows.length} unique attendance records exported from ${page - 1} pages.`
    );
})();
