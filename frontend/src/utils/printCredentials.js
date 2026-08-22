/**
 * Opens a plain, isolated print window with its own minimal stylesheet —
 * deliberately NOT window.print() on the app itself, which would try to
 * print the whole page (nav, modal overlay, buttons and all) and produce a
 * mess. Auto-triggers the print dialog once the content has rendered.
 * Shared by PortalCredentialsModal (class-wide list) and the manager
 * Students page's "new account just created" reveal.
 */
export function openCredentialsPrintWindow(title, rows) {
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return; // popup blocked — callers offer CSV download as a fallback
  const escapeHtml = (v) =>
    String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  win.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          p.meta { font-size: 12px; color: #64748b; margin-top: 0; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; }
          td.mono { font-family: "SF Mono", Consolas, monospace; }
          td.muted { color: #94a3b8; font-style: italic; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">Printed ${new Date().toLocaleString()} — temporary passwords shown here can no longer be recovered once a student changes their own password.</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Admission No.</th>
              <th>Portal ID</th>
              <th>Temp Password</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
              <tr>
                <td>${escapeHtml(r.studentName)}</td>
                <td>${escapeHtml(r.admissionNumber) || "—"}</td>
                <td class="mono">${escapeHtml(r.portalUsername) || "—"}</td>
                ${
                  r.tempPassword
                    ? `<td class="mono">${escapeHtml(r.tempPassword)}</td>`
                    : `<td class="muted">${r.portalUsername ? "Already changed by student" : "No account yet"}</td>`
                }
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.onload = () => win.print();
}

export function downloadCredentialsCsv(filename, rows) {
  const escapeCsv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Name", "Admission No.", "Portal ID", "Temp Password"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.studentName,
        r.admissionNumber,
        r.portalUsername || "",
        r.tempPassword || (r.portalUsername ? "Already changed by student" : "No account yet"),
      ]
        .map(escapeCsv)
        .join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
