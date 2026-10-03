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

    // Rank history uses its own page and must never count as attendance.
    const rankRows = [];
    const seenRankPages = new Set();
    let rankPage = 1;
    while (true) {
        const url = new URL("/members/ranks", window.location.origin);
        if (rankPage > 1) url.searchParams.set("page", String(rankPage));
        try {
            console.log(`Fetching ranks page ${rankPage}...`);
            const response = await fetch(url.href, { credentials: "include" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const doc = new DOMParser().parseFromString(await response.text(), "text/html");
            const records = [...doc.querySelectorAll("table")].flatMap(table => {
                const headers = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
                const headerIndex = pattern => headers.findIndex(header => pattern.test(header));
                return [...table.querySelectorAll("tbody tr")].flatMap(tr => {
                    const cells = [...tr.querySelectorAll("td")].map(td => {
                        const text = td.textContent.trim().replace(/\s+/g, " ");
                        const rankLabel = [td, ...td.querySelectorAll("[title], [aria-label], img[alt]")]
                            .flatMap(element => [element.getAttribute("title"), element.getAttribute("aria-label"), element.getAttribute("alt")])
                            .find(value => value && /\b(?:W|B|P|BR|BK|BL|BLACK|BROWN)-\d+\b/i.test(value));
                        return rankLabel && !text.includes(rankLabel) ? `${text} ${rankLabel}`.trim() : text;
                    });
                    const rankIndex = headerIndex(/^(?:current\s+)?rank$|belt/i);
                    const dateIndex = headerIndex(/date|promoted on|awarded on/i);
                    const rawRank = cells[rankIndex] || cells.find(cell => /\b(?:W|B|P|BR|BK|BL|BLACK|BROWN)-\d+\b/i.test(cell)) || "";
                    const date = cells[dateIndex] || cells.find(cell => /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\b/.test(cell)) || "";
                    const rank = rawRank.match(/\b(?:W|B|P|BR|BK|BL|BLACK|BROWN)-\d+\b/i)?.[0].toUpperCase() || rawRank;
                    if (!rank || !date) return [];
                    const stripeIndex = headerIndex(/stripe/i);
                    const stripeMatch = rank.match(/\b(?:W|B|P|BR|BK|BL|BLACK|BROWN)-(\d+)\b/i) || rank.match(/(\d+)\s*stripes?/i);
                    const disciplineIndex = headerIndex(/discipline|program|martial art|style/i);
                    const rawDiscipline = cells[disciplineIndex] || cells.find(cell => /^(?:BJJ|Brazilian Jiu[- ]?Jitsu|Jiu[- ]?Jitsu|Judo|Karate|Taekwondo)$/i.test(cell)) || "";
                    const statusIndex = headerIndex(/status|action|type/i);
                    const rawStatus = cells[statusIndex] || cells.find(cell => /^(?:promoted|demoted|assigned|awarded)$/i.test(cell)) || "";
                    const discipline = /\bBJJ\b/i.test(cells.join(" ")) ? "BJJ" : rawDiscipline;
                    const status = rawStatus || cells.join(" ").match(/\b(?:Promoted|Demoted|Assigned|Awarded)\b/i)?.[0] || "";
                    const promotionDate = date.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/)?.[0] || date;
                    return [{ rank, date: promotionDate, stripes: cells[stripeIndex] || stripeMatch?.[1] || "", discipline, status, details: JSON.stringify({ headers, cells }) }];
                });
            });
            if (!records.length) {
                if (rankPage === 1) console.log("No dated rank records found. Attendance will still be exported. Check the ranks table if you expected belt or stripe history.");
                break;
            }
            const signature = JSON.stringify(records);
            if (seenRankPages.has(signature)) break;
            seenRankPages.add(signature);
            rankRows.push(...records);
            rankPage++;
        } catch (error) {
            console.log(`Ranks request failed on page ${rankPage}. Exporting the records fetched so far.`, error);
            break;
        }
    }
    const uniqueRanks = [...new Map(rankRows.map(row => [JSON.stringify([row.discipline, row.rank, row.date, row.stripes]), row])).values()];

    function escapeCSV(value) {
        return `"${String(value ?? "").replace(/"/g, '""')}"`;
    }

    const csv = [
        ["Training", "Date / Time / Duration", "Record Type", "Rank", "Promotion Date", "Stripes", "Discipline", "Rank Status", "Rank Details"]
            .map(escapeCSV)
            .join(","),

        ...uniqueRows.map(row =>
            [
                row.training,
                row.details,
                "attendance", "", "", "", "", "", ""
            ]
                .map(escapeCSV)
                .join(",")
        ),
        ...uniqueRanks.map(row => ["", "", "rank", row.rank, row.date, row.stripes, row.discipline, row.status, row.details].map(escapeCSV).join(","))
    ].join("\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const downloadUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = downloadUrl;
    const downloadedAt = new Date();
    const downloadDate = [
        downloadedAt.getFullYear(),
        String(downloadedAt.getMonth() + 1).padStart(2, "0"),
        String(downloadedAt.getDate()).padStart(2, "0")
    ].join("-");
    a.download = `gymdesk-all-attendance-${downloadDate}.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(downloadUrl);

    console.log(
        `Finished: ${uniqueRows.length} unique attendance records and ${uniqueRanks.length} rank records exported.`
    );
})();
