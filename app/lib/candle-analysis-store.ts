import { database } from "./auth";
import type { CandleAnalysisReport } from "../candle-types";

database.exec(`
  CREATE TABLE IF NOT EXISTS candle_analysis_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market TEXT NOT NULL,
    frame TEXT NOT NULL,
    generated_at INTEGER NOT NULL,
    report_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS candle_analysis_reports_user_created_idx
    ON candle_analysis_reports(user_id, generated_at DESC);
`);

const insertReport = database.prepare(`
  INSERT INTO candle_analysis_reports (id, user_id, market, frame, generated_at, report_json)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const trimReports = database.prepare(`
  DELETE FROM candle_analysis_reports
  WHERE user_id = ? AND id NOT IN (
    SELECT id FROM candle_analysis_reports
    WHERE user_id = ?
    ORDER BY generated_at DESC
    LIMIT 100
  )
`);
const saveTransaction = database.transaction((userId: string, report: CandleAnalysisReport) => {
  insertReport.run(report.id, userId, report.market, report.frame, report.generatedAt, JSON.stringify(report));
  trimReports.run(userId, userId);
});

export function saveCandleAnalysisReport(userId: string, report: CandleAnalysisReport) {
  saveTransaction(userId, report);
}

export function listCandleAnalysisReports(userId: string): CandleAnalysisReport[] {
  const rows = database.prepare(`
    SELECT report_json FROM candle_analysis_reports
    WHERE user_id = ?
    ORDER BY generated_at DESC
    LIMIT 100
  `).all(userId) as { report_json: string }[];
  return rows.map(({ report_json }) => JSON.parse(report_json) as CandleAnalysisReport);
}
