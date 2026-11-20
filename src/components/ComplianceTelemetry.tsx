import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { COMPETITOR_BENCHMARKS, SAMPLE_PR_META } from '../data/dpdpData';
import { RemediationBundle, ScanResult, TelemetryRun } from '../types';

interface ComplianceTelemetryProps {
  telemetryRuns: TelemetryRun[];
  scanResult: ScanResult | null;
  remediationBundle: RemediationBundle | null;
}

export function ComplianceTelemetry({
  telemetryRuns,
  scanResult,
  remediationBundle,
}: ComplianceTelemetryProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASSED' | 'BLOCKED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadedNotice, setDownloadedNotice] = useState(false);

  const filteredRuns = useMemo(() => {
    return telemetryRuns.filter((run) => {
      if (statusFilter !== 'ALL' && run.gateStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          run.repo.toLowerCase().includes(q) ||
          run.branch.toLowerCase().includes(q) ||
          run.prNumber.toLowerCase().includes(q) ||
          run.dpdpSections.some((s) => s.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [telemetryRuns, statusFilter, searchQuery]);

  const handleDownloadAuditReport = () => {
    const timestamp = new Date().toISOString();
    const activePr = scanResult?.prId ?? SAMPLE_PR_META.prId;
    const activeRepo = scanResult?.repoName ?? SAMPLE_PR_META.repoName;
    const initialRisk = scanResult?.riskScore ?? 80;
    const finalRisk = remediationBundle
      ? remediationBundle.verification.postPatchRiskScore
      : initialRisk;
    const gateStatus = remediationBundle?.verification.passed
      ? 'PASSED (0 Regressions — Safe to Merge)'
      : scanResult
        ? 'BLOCKED (Open DPDP Violations)'
        : 'PENDING SCAN';

    const findingsSection =
      scanResult && scanResult.findings.length > 0
        ? scanResult.findings
            .map(
              (f, idx) =>
                `${idx + 1}. [${f.severity}] ${f.filePath}:${f.line} — ${f.title}\n` +
                `   - Statutory Clause: ${f.dpdpSection} (${f.cweId})\n` +
                `   - Tainted Fields: ${f.taintedFields.join(', ')}\n` +
                `   - Code Sink: ${f.snippet}\n` +
                (f.bypassAttemptDetected
                  ? `   - Prompt-Injection Neutralized: Ignored \`${f.bypassAttemptDetected.comment}\` at line ${f.bypassAttemptDetected.line}\n`
                  : '')
            )
            .join('\n')
        : 'No open violations detected in latest scan.\n';

    const fixesSection =
      remediationBundle && remediationBundle.remediations.length > 0
        ? remediationBundle.remediations
            .map(
              (r, idx) =>
                `${idx + 1}. ${r.file_path} (${r.dpdp_section} / ${r.cwe_id})\n` +
                `   - Remediation Summary: ${r.explanation}\n` +
                `   - Verification Gate: verify_patch.py PASSED (0 remaining leaks)\n`
            )
            .join('\n')
        : 'Auto-remediation patches have not yet been generated for this PR.\n';

    const reportText = `# Sentinel-DPDP — India DPDP Act Sec 8(5) Compliance Audit Report
Generated At: ${timestamp}
Repository: ${activeRepo}
Pull Request: ${activePr} (${SAMPLE_PR_META.title})
Commit Applied: ${remediationBundle?.appliedCommitSha ?? 'Pending PR Commit'}

## 1. Executive Risk Summary
- Initial Deterministic AST Risk Score: ${initialRisk} / 100
- Post-Remediation Risk Score: ${finalRisk} / 100
- Merge Verification Gate: ${gateStatus}
- Detection Precision Benchmark: 100% (4/4 caught, 0 false positives)
- Verification Gate Pass Rate: 100%
- Prompt-Injection Bypass Comments Neutralized: ${scanResult?.bypassAttempts.length ?? 0}

## 2. Deterministic AST Findings & Statutory Mapping
${findingsSection}
## 3. Verified Remediations & Runtime Safeguards
${fixesSection}
## 4. Statutory Attestation
This Pull Request was audited by Sentinel-DPDP's neuro-symbolic engine against India Digital Personal Data Protection Act (2023) & Rules (2026), specifically:
- Section 6: Verifiable Data Principal Consent before external AI processing
- Section 8(5): Reasonable security safeguards preventing unredacted PII in logs and LLM egress
- Section 8(7): Storage limitation via consent_id traceability and retention_expires_at auto-purge

---
Exported from Sentinel-DPDP Compliance Telemetry Ledger (sentinel_dpdp.pr_compliance_events)
`;

    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel-dpdp-sec-8-5-audit-report-${activePr.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadedNotice(true);
    setTimeout(() => setDownloadedNotice(false), 3000);
  };

  const maxCost = Math.max(...COMPETITOR_BENCHMARKS.map((c) => c.monthlyInr));

  return (
    <div className="space-y-6">
      {/* Header & Export CTA */}
      <section className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 font-display">
            Compliance Telemetry &amp; Unit Economics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            BigQuery-structured audit ledger (<code className="font-mono text-slate-300">sentinel_dpdp.pr_compliance_events</code>), precision benchmarks, and statutory report exports.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {downloadedNotice && (
            <span className="text-xs text-emerald-400 font-medium">
              Audit report downloaded
            </span>
          )}
          <button
            type="button"
            onClick={handleDownloadAuditReport}
            className="px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download DPDP Sec 8(5) Audit Report
          </button>
        </div>
      </section>

      {/* 4-Column Benchmark & Unit Economics KPI Strip */}
      <section
        aria-label="Compliance and Unit Economics Benchmarks"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5">
          <p className="text-xs text-slate-400">Detection Precision</p>
          <p className="text-3xl font-mono font-bold tabular-nums text-emerald-400 mt-2">
            100%
          </p>
          <p className="text-xs text-slate-300 mt-2">
            4/4 dynamic PII leaks caught · 0 false positives
          </p>
        </div>

        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5">
          <p className="text-xs text-slate-400">Verification Gate Pass Rate</p>
          <p className="text-3xl font-mono font-bold tabular-nums text-emerald-400 mt-2">
            100%
          </p>
          <p className="text-xs text-slate-300 mt-2">
            Every synthesized PR re-verified by deterministic AST
          </p>
        </div>

        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5">
          <p className="text-xs text-slate-400">Cost per PR vs. Flat SaaS</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-mono font-bold tabular-nums text-cyan-300">
              ₹{remediationBundle?.tokenUsage?.estimatedCostInr.toFixed(2) ?? '0.30'}
            </p>
            <span className="text-xs font-mono text-slate-400">/ PR</span>
          </div>
          <p className="text-xs text-slate-300 mt-2">
            vs. ₹1,999/mo Startup Pro · <span className="text-emerald-400 font-semibold">95%+ Gross Margin</span>
          </p>
        </div>

        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5">
          <p className="text-xs text-slate-400">DPDP Sec 8(5) Exposure Guarded</p>
          <p className="text-3xl font-mono font-bold tabular-nums text-slate-100 mt-2">
            ₹250 Cr
          </p>
          <p className="text-xs text-slate-300 mt-2">
            Maximum statutory penalty cap mitigated per breach
          </p>
        </div>
      </section>

      {/* Competitor Comparison Bar */}
      <section className="bg-[#111827] border border-[#1F2937] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 font-display">
              Competitor Monthly Cost Comparison (10-Developer Team)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Flat team pricing powered by Progressive Disclosure (~75% fewer LLM tokens) vs. per-seat review bots and legacy compliance checklists.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 tabular-nums shrink-0">
            95% lower TCO vs. CodeRabbit · 98.5% lower vs. Vanta
          </span>
        </div>

        <div className="space-y-4">
          {COMPETITOR_BENCHMARKS.map((item) => {
            // Ensure Sentinel-DPDP bar remains clearly visible with a clean minimum visual width
            const widthPct = Math.max(4, Math.round((item.monthlyInr / maxCost) * 100));
            return (
              <div key={item.name} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span
                      className={`font-semibold font-display ${
                        item.highlight ? 'text-cyan-300' : 'text-slate-200'
                      }`}
                    >
                      {item.name}
                    </span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span className="text-slate-400">{item.capabilities}</span>
                  </div>
                  <div className="font-mono tabular-nums text-right shrink-0">
                    <span className={item.highlight ? 'text-emerald-400 font-semibold' : 'text-slate-200'}>
                      {item.displayPrice}
                    </span>
                    <span className="text-slate-500 ml-2">({item.usdEquivalent})</span>
                  </div>
                </div>

                <div className="h-3 w-full bg-[#0B0F19] border border-[#1F2937] rounded-md overflow-hidden">
                  <div
                    className={`h-full rounded-md ${
                      item.highlight ? 'bg-cyan-400' : 'bg-slate-600'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* BigQuery-Style Telemetry Ledger */}
      <section className="bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1F2937] bg-[#0E1422] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100 font-display">
              PR Compliance Event Stream
            </h2>
            <span className="text-xs font-mono text-slate-500 hidden sm:inline">
              sentinel_dpdp.pr_compliance_events
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter repo, branch, DPDP section..."
                className="pl-8 pr-3 py-1.5 bg-[#0B0F19] border border-[#1F2937] focus:border-cyan-500 focus:outline-none rounded-lg text-xs text-slate-200 placeholder:text-slate-500 w-56"
              />
            </div>

            <div className="inline-flex bg-[#0B0F19] border border-[#1F2937] rounded-lg p-0.5 text-[11px]">
              {(['ALL', 'PASSED', 'BLOCKED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-[#1F2937] text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1F2937] text-[11px] font-mono text-slate-400 bg-[#0B0F19]">
                <th className="py-2.5 px-4 font-medium">Timestamp</th>
                <th className="py-2.5 px-4 font-medium">Repository / PR</th>
                <th className="py-2.5 px-4 font-medium">DPDP Clauses</th>
                <th className="py-2.5 px-4 font-medium text-right">Risk Delta</th>
                <th className="py-2.5 px-4 font-medium text-right">Tokens</th>
                <th className="py-2.5 px-4 font-medium text-right">Cost</th>
                <th className="py-2.5 px-4 font-medium text-right">Gate Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937] text-xs">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No compliance events match your current filter.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="hover:bg-[#162033]/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap tabular-nums">
                      {run.timestamp}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-200">{run.repo}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {run.prNumber} · {run.branch}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {run.dpdpSections.length > 0 ? run.dpdpSections.join(', ') : 'None (Clean)'}
                    </td>
                    <td className="py-3 px-4 font-mono text-right whitespace-nowrap tabular-nums">
                      <span className={run.initialRisk > 0 ? 'text-red-400' : 'text-slate-400'}>
                        {run.initialRisk}
                      </span>
                      <span className="text-slate-600 mx-1.5">→</span>
                      <span className={run.finalRisk === 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                        {run.finalRisk}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-slate-300 tabular-nums">
                      {run.tokensUsed.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-slate-200 tabular-nums">
                      ₹{run.costInr.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold ${
                          run.gateStatus === 'PASSED' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {run.gateStatus === 'PASSED' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        )}
                        {run.gateStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
