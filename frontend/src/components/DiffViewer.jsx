import React, { useState } from "react";
import { Columns, Eye } from "lucide-react";

export default function DiffViewer({ diffResult }) {
  const [viewMode, setViewMode] = useState("split"); // 'split' or 'unified'

  if (!diffResult || !diffResult.diff) return null;

  const { diff } = diffResult;

  const stats = diff.reduce(
    (acc, item) => {
      if (item.type === "insert") acc.added++;
      else if (item.type === "delete") acc.deleted++;
      else if (item.type === "equal") acc.unchanged++;

      return acc;
    },
    {
      added: 0,
      deleted: 0,
      unchanged: 0,
    },
  );

  // Alignment helper for side-by-side (split) view
  const getAlignedRows = () => {
    const rows = [];
    let i = 0;

    while (i < diff.length) {
      if (diff[i].type === "equal") {
        rows.push({
          left: diff[i],
          right: diff[i],
        });
        i++;
      } else {
        // Gather consecutive deletes and inserts in this chunk
        const deletes = [];
        const inserts = [];

        while (i < diff.length && diff[i].type !== "equal") {
          if (diff[i].type === "delete") {
            deletes.push(diff[i]);
          } else if (diff[i].type === "insert") {
            inserts.push(diff[i]);
          }
          i++;
        }

        const maxLen = Math.max(deletes.length, inserts.length);
        for (let k = 0; k < maxLen; k++) {
          rows.push({
            left: deletes[k] || null,
            right: inserts[k] || null,
          });
        }
      }
    }
    return rows;
  };

  const alignedRows = getAlignedRows();

  return (
    <div className="glass-panel viz-panel">
      <div className="viz-header">
        <div className="viz-title">
          <span>Text Comparison Output</span>
          <span className="algo-pill">{diffResult.algorithm}</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginLeft: "1rem",
            fontSize: "0.9rem",
          }}
        >
          <span style={{ color: "#22c55e" }}>+ {stats.added} Added</span>

          <span style={{ color: "#ef4444" }}>- {stats.deleted} Deleted</span>

          <span style={{ color: "#94a3b8" }}>
            = {stats.unchanged} Unchanged
          </span>
        </div>
        <div className="diff-view-mode">
          <button
            onClick={() => setViewMode("split")}
            className={`btn btn-secondary ${viewMode === "split" ? "active" : ""}`}
            style={{
              padding: "0.4rem 0.8rem",
              display: "flex",
              gap: "0.4rem",
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
            }}
          >
            <Columns size={16} />
            Split
          </button>
          <button
            onClick={() => setViewMode("unified")}
            className={`btn btn-secondary ${viewMode === "unified" ? "active" : ""}`}
            style={{
              padding: "0.4rem 0.8rem",
              display: "flex",
              gap: "0.4rem",
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderLeft: 0,
            }}
          >
            <Eye size={16} />
            Unified
          </button>
        </div>
      </div>

      {viewMode === "unified" ? (
        // Unified (Inline) View
        <div className="diff-content">
          <table className="diff-table">
            <tbody>
              {diff.map((item, idx) => {
                const isInsert = item.type === "insert";
                const isDelete = item.type === "delete";
                const rowClass = isInsert
                  ? "diff-insert"
                  : isDelete
                    ? "diff-delete"
                    : "diff-equal";
                const sign = isInsert ? "+" : isDelete ? "-" : " ";

                return (
                  <tr key={idx} className={`diff-row ${rowClass}`}>
                    <td className="diff-cell-num">{item.lineNoA || ""}</td>
                    <td className="diff-cell-num">{item.lineNoB || ""}</td>
                    <td className="diff-cell-content">
                      <span className="diff-sign">{sign}</span>
                      {item.line}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // Split (Side-by-Side) View
        <div className="split-diff-container">
          {/* Left Pane (File A / Original) */}
          <div className="split-pane">
            <div className="split-header">Original (File A)</div>
            <div
              className="diff-content"
              style={{ border: 0, borderRadius: 0 }}
            >
              <table className="diff-table">
                <tbody>
                  {alignedRows.map((row, idx) => {
                    const item = row.left;

                    if (!item) {
                      return (
                        <tr key={idx} className="diff-row diff-empty">
                          <td
                            className="diff-cell-num"
                            style={{ borderRight: 0 }}
                          ></td>
                          <td
                            className="diff-cell-content"
                            style={{ minHeight: "22px" }}
                          >
                            &nbsp;
                          </td>
                        </tr>
                      );
                    }

                    const isDelete = item.type === "delete";
                    const rowClass = isDelete ? "diff-delete" : "diff-equal";
                    const sign = isDelete ? "-" : " ";

                    return (
                      <tr key={idx} className={`diff-row ${rowClass}`}>
                        <td className="diff-cell-num">{item.lineNoA}</td>
                        <td className="diff-cell-content">
                          <span className="diff-sign">{sign}</span>
                          {item.line}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Pane (File B / Modified) */}
          <div className="split-pane">
            <div className="split-header">Modified (File B)</div>
            <div
              className="diff-content"
              style={{ border: 0, borderRadius: 0 }}
            >
              <table className="diff-table">
                <tbody>
                  {alignedRows.map((row, idx) => {
                    const item = row.right;
                    if (!item) {
                      return (
                        <tr key={idx} className="diff-row diff-empty">
                          <td
                            className="diff-cell-num"
                            style={{ borderRight: 0 }}
                          ></td>
                          <td
                            className="diff-cell-content"
                            style={{ minHeight: "22px" }}
                          >
                            &nbsp;
                          </td>
                        </tr>
                      );
                    }
                    const isInsert = item.type === "insert";
                    const rowClass = isInsert ? "diff-insert" : "diff-equal";
                    const sign = isInsert ? "+" : " ";
                    return (
                      <tr key={idx} className={`diff-row ${rowClass}`}>
                        <td className="diff-cell-num">{item.lineNoB}</td>
                        <td className="diff-cell-content">
                          <span className="diff-sign">{sign}</span>
                          {item.line}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
