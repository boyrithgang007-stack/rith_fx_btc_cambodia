import { execute, query, transaction } from "./database";
import type { CandleAnalysisReport } from "../candle-types";

export async function saveCandleAnalysisReport(userId: string, report: CandleAnalysisReport) {
  await transaction(async client => {
    await execute("INSERT INTO candle_analysis_reports (id,user_id,market,frame,generated_at,report_json) VALUES (?,?,?,?,?,?)",
      [report.id, userId, report.market, report.frame, report.generatedAt, JSON.stringify(report)], client);
    await execute(`DELETE FROM candle_analysis_reports WHERE user_id=? AND id NOT IN (
      SELECT id FROM candle_analysis_reports WHERE user_id=? ORDER BY generated_at DESC LIMIT 100)`, [userId, userId], client);
  });
}

export async function listCandleAnalysisReports(userId: string): Promise<CandleAnalysisReport[]> {
  const rows = await query<{ report_json: string }>("SELECT report_json FROM candle_analysis_reports WHERE user_id=? ORDER BY generated_at DESC LIMIT 100", [userId]);
  return rows.map(({ report_json }) => {
    const report = JSON.parse(report_json) as CandleAnalysisReport;
    // Older saved reports may predate the AI review field. Keep their history
    // readable and explicitly mark the review as unavailable.
    const { status, consistent, summary, risks, observations } = report.ai ?? {
      status: "not_requested" as const,
      consistent: null,
      summary: "No AI review was saved for this report.",
      risks: [],
      observations: [],
    };
    return { ...report, ai: { status, consistent, summary, risks, observations } };
  });
}
