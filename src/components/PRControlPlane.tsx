import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FileCode2,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  MessageSquareText,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import {
  CUSTOM_CODE_PRESETS,
  DPDP_2026_RULES,
  SAMPLE_PR_META,
} from '../data/dpdpData';
import {
  CodeLanguage,
  DPDPFinding,
  PRFile,
  RemediationBundle,
  ScanResult,
} from '../types';
import { DiffViewer } from './DiffViewer';
import { RiskGauge } from './RiskGauge';

export type PipelineStep = 0 | 1 | 2 | 3 | 4;

interface PRControlPlaneProps {
  mode: 'sample' | 'custom';
  onModeChange: (mode: 'sample' | 'custom') => void;
  files: PRFile[];
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  customLanguage: CodeLanguage;
  onCustomLanguageChange: (lang: CodeLanguage) => void;
  customCode: string;
  onCustomCodeChange: (code: string) => void;
  scanResult: ScanResult | null;
  remediationBundle: RemediationBundle | null;
  pipelineStep: PipelineStep;
  isRemediating: boolean;
  remediationError: string | null;
  onRunScan: () => void;
  onGenerateFixPR: (verificationFeedback?: string) => void;
  onApplyCommit: () => void;
  onResetDemo: () => void;
  onOpenAuditor: () => void;
  highlightedLine: { filePath: string; line: number } | null;
}

const PIPELINE_STAGES = [
  { step: 1, label: '1. AST Scan' },
  { step: 2, label: '2. Loading Matched DPDP Rules' },
  { step: 3, label: '3. Gemini Patch Synthesis' },
  { step: 4, label: '4. Verification Gate' },
] as const;

export function PRControlPlane({
  mode,
  onModeChange,
  files,
  activeFilePath,
  onSelectFile,
  customLanguage,
  onCustomLanguageChange,
  customCode,
  onCustomCodeChange,
  scanResult,
  remediationBundle,
  pipelineStep,
  isRemediating,
  remediationError,
  onRunScan,
  onGenerateFixPR,
  onApplyCommit,
  onResetDemo,
  onOpenAuditor,
  highlightedLine,
}: PRControlPlaneProps) {
  const [showDiffMode, setShowDiffMode] = useState(true);

  const activeFile = useMemo(
    () => files.find((f) => f.path === activeFilePath) ?? files[0],
    [files, activeFilePath]
  );

  const findingsForActiveFile = useMemo(
    () => (scanResult?.findings ?? []).filter((f) => f.filePath === activeFile?.path),
    [scanResult, activeFile]
  );

  const bypassesForActiveFile = useMemo(
    () => (scanResult?.bypassAttempts ?? []).filter((b) => b.filePath === activeFile?.path),
    [scanResult, activeFile]
  );

  const activeRemediation = useMemo(
    () => remediationBundle?.remediations.find((r) => r.file_path === activeFile?.path),
    [remediationBundle, activeFile]
  );

  const displayedRiskScore = useMemo(() => {
    if (!scanResult) return null;
    if (remediationBundle) {
      return remediationBundle.verification.postPatchRiskScore;
    }
    return scanResult.riskScore;
  }, [scanResult, remediationBundle]);

  const activeOpenLeaks = remediationBundle
    ? remediationBundle.verification.remainingFindings.length
    : (scanResult?.findings.length ?? 0);

  const matchedRulesCount = scanResult?.matchedRuleIds.length ?? 0;
  const totalRulesCount = DPDP_2026_RULES.length;

  const handleJumpFinding = (finding: DPDPFinding) => {
    onSelectFile(finding.filePath);
  };

  return (
    <div className="space-y-5">
      {/* Workspace Action & PR Selector Bar */}
      <section className="bg-[#111827] border border-[#1F2937] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
          {/* Segmented Mode Switcher */}
          <div
            role="tablist"
            aria-label="Repository Source Selector"
            className="inline-flex items-center bg-[#0B0F19] border border-[#1F2937] rounded-lg p-1 shrink-0 w-fit"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'sample'}
              onClick={() => onModeChange('sample')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                mode === 'sample'
                  ? 'bg-[#1F2937] text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitPullRequest className="w-3.5 h-3.5 text-cyan-400" />
              PR #42 (Sample)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'custom'}
              onClick={() => onModeChange('custom')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                mode === 'custom'
                  ? 'bg-[#1F2937] text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              Custom Snippet
            </button>
          </div>

          <div className="min-w-0">
            {mode === 'sample' ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="font-mono font-semibold text-slate-100 truncate">
                  {SAMPLE_PR_META.repoName}
                </span>
                <span className="text-slate-600" aria-hidden="true">/</span>
                <span className="font-medium text-slate-200 truncate">
                  {SAMPLE_PR_META.prId}: {SAMPLE_PR_META.title}
                </span>
                <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
                <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
                  3 files · base: {SAMPLE_PR_META.baseBranch}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-300 font-medium">Language:</span>
                {(['python', 'typescript', 'sql'] as CodeLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => onCustomLanguageChange(lang)}
                    className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap ${
                      customLanguage === lang
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-[#0B0F19] text-slate-400 border border-[#1F2937] hover:text-slate-200'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Primary Workflow Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {(scanResult || remediationBundle) && (
            <button
              type="button"
              onClick={onResetDemo}
              title="Reset PR workspace to unpatched state"
              className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-[#0B0F19] border border-[#1F2937] hover:border-slate-600 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}

          <button
            type="button"
            onClick={onRunScan}
            disabled={isRemediating}
            className="px-4 py-2 text-xs font-semibold text-slate-100 bg-[#1F2937] hover:bg-slate-700 border border-slate-600/70 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 text-cyan-400" />
            Run Deterministic Scan
          </button>

          <button
            type="button"
            onClick={() => onGenerateFixPR()}
            disabled={
              isRemediating ||
              !scanResult ||
              scanResult.findings.length === 0 ||
              Boolean(remediationBundle?.verification.passed)
            }
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            {isRemediating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Synthesizing Fix PR...
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                Generate Verified Fix PR
              </>
            )}
          </button>
        </div>
      </section>

      {/* 4-Step Pipeline Progress Rail */}
      <section
        aria-label="Remediation Pipeline Progress"
        className="bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3"
      >
        <ol className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PIPELINE_STAGES.map((stage) => {
            const isComplete =
              (stage.step === 1 && pipelineStep >= 1) ||
              (stage.step === 2 && pipelineStep >= 2 && !isRemediating) ||
              (stage.step === 2 && pipelineStep > 2) ||
              (stage.step === 3 && pipelineStep > 3) ||
              (stage.step === 4 && Boolean(remediationBundle?.verification.passed));

            const isActive = isRemediating && pipelineStep === stage.step;

            return (
              <li
                key={stage.step}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  isComplete
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : isActive
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                      : 'bg-[#0B0F19] border-[#1F2937] text-slate-400'
                }`}
              >
                {isActive ? (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                ) : isComplete ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                )}
                <span className="truncate">{stage.label}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* API Error Alert */}
      {remediationError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">Auto-Remediation Error</p>
              <p className="mt-0.5 text-red-200/90">{remediationError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onGenerateFixPR()}
            className="px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-100 font-medium whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Split Workspace (Code/Diff Left + Risk Gauge & Findings Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left 8 Columns: Code / Diff Surface */}
        <section className="xl:col-span-8 bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden">
          {/* File Tabs Bar */}
          <div className="px-3 pt-2.5 border-b border-[#1F2937] bg-[#0E1422] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              {files.map((file) => {
                const fileFindingsCount = remediationBundle?.verification.passed
                  ? 0
                  : (scanResult?.findings ?? []).filter((f) => f.filePath === file.path).length;
                const isSelected = file.path === activeFile?.path;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => onSelectFile(file.path)}
                    className={`px-3 py-2 text-xs font-mono border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                      isSelected
                        ? 'border-cyan-400 text-slate-100 bg-[#111827]'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{file.path}</span>
                    {scanResult && (
                      <span
                        className={`text-[11px] font-mono tabular-nums ${
                          fileFindingsCount > 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {fileFindingsCount > 0 ? `${fileFindingsCount}` : '0'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Toggle Source vs Verified Diff when remediation exists */}
            <div className="flex items-center gap-2 pb-2">
              {activeRemediation && (
                <div className="inline-flex bg-[#0B0F19] border border-[#1F2937] rounded-md p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setShowDiffMode(true)}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      showDiffMode ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Verified Diff
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiffMode(false)}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      !showDiffMode ? 'bg-[#1F2937] text-slate-100' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Source File
                  </button>
                </div>
              )}

              {remediationBundle?.verification.passed && !remediationBundle.appliedCommitSha && (
                <button
                  type="button"
                  onClick={onApplyCommit}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <GitCommitHorizontal className="w-3.5 h-3.5" />
                  1-Click Apply PR Commit
                </button>
              )}

              {remediationBundle && !remediationBundle.verification.passed && (
                <button
                  type="button"
                  onClick={() => {
                    const feedback = remediationBundle.verification.remainingFindings
                      .map((f) => `${f.filePath}:${f.line} [${f.dpdpSection}] ${f.description}`)
                      .join('\n');
                    onGenerateFixPR(feedback);
                  }}
                  disabled={isRemediating}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-Synthesize Residual Fixes
                </button>
              )}
            </div>
          </div>

          {/* Code Viewer / Custom Editor / Side-by-Side Diff */}
          {activeRemediation && showDiffMode ? (
            <DiffViewer
              originalCode={activeFile.content}
              remediation={activeRemediation}
            />
          ) : mode === 'custom' ? (
            <div className="p-4 bg-[#0B0F19]">
              <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
                <span>
                  Paste any Python, TypeScript, or SQL code snippet below and run the deterministic AST scan.
                </span>
                <button
                  type="button"
                  onClick={() => onCustomCodeChange(CUSTOM_CODE_PRESETS[customLanguage].code)}
                  className="text-cyan-400 hover:text-cyan-300 font-medium whitespace-nowrap"
                >
                  Load vulnerable example
                </button>
              </div>
              <textarea
                value={customCode}
                onChange={(e) => onCustomCodeChange(e.target.value)}
                spellCheck={false}
                rows={18}
                aria-label="Custom code snippet editor"
                className="w-full rounded-lg bg-[#111827] border border-[#1F2937] focus:border-cyan-500 focus:outline-none p-4 font-mono text-xs text-slate-100 leading-6 resize-y"
              />
            </div>
          ) : (
            <div className="bg-[#0B0F19] overflow-x-auto max-h-[520px] overflow-y-auto">
              <div className="px-4 py-2 border-b border-[#1F2937] flex items-center justify-between text-xs text-slate-400 bg-[#0D1320]">
                <span>{activeFile?.description}</span>
                <span className="font-mono text-[11px] text-slate-500">
                  {activeFile?.language} · {activeFile?.content.split('\n').length} lines
                </span>
              </div>

              <div className="py-2 font-mono text-xs leading-6">
                {(activeFile?.content ?? '').split('\n').map((line, index) => {
                  const lineNum = index + 1;
                  const lineFinding = !remediationBundle?.verification.passed
                    ? findingsForActiveFile.find((f) => f.line === lineNum)
                    : undefined;
                  const lineBypass = !remediationBundle?.verification.passed
                    ? bypassesForActiveFile.find((b) => b.line === lineNum)
                    : undefined;
                  const isFocused =
                    highlightedLine?.filePath === activeFile?.path &&
                    highlightedLine?.line === lineNum;

                  return (
                    <div key={lineNum}>
                      <div
                        className={`flex px-2 transition-colors ${
                          lineFinding
                            ? 'bg-red-500/15 text-red-100'
                            : lineBypass
                              ? 'bg-amber-500/10 text-amber-200'
                              : isFocused
                                ? 'bg-cyan-500/15 text-cyan-100'
                                : 'text-slate-300 hover:bg-slate-800/30'
                        }`}
                      >
                        <span className="w-11 shrink-0 select-none text-right pr-3 text-slate-500 tabular-nums border-r border-[#1F2937]/70">
                          {lineNum}
                        </span>
                        <pre className="pl-3 pr-4 whitespace-pre">{line || ' '}</pre>
                      </div>

                      {lineBypass && (
                        <div className="ml-11 px-3 py-1 bg-amber-500/10 border-y border-amber-500/20 text-[11px] font-sans text-amber-200 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            Prompt-injection bypass comment ignored deterministically ({lineBypass.comment})
                          </span>
                        </div>
                      )}

                      {lineFinding && (
                        <div className="ml-11 px-3 py-2 bg-red-950/50 border-y border-red-500/30 text-xs font-sans text-red-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="font-semibold text-red-300">
                              {lineFinding.dpdpSection} · {lineFinding.cweId}
                            </span>
                            <span className="text-slate-300">— {lineFinding.title}</span>
                          </div>
                          <span className="font-mono text-[11px] text-red-300 tabular-nums">
                            +{lineFinding.riskPoints} risk pts
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progressive Disclosure Context Footer */}
          {scanResult && (
            <div className="px-4 py-2.5 border-t border-[#1F2937] bg-[#0E1422] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-slate-300 font-medium">Progressive Disclosure Payload:</span>
                <span className="font-mono text-cyan-300 tabular-nums">
                  {matchedRulesCount}/{totalRulesCount} rules injected
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  AST scan: {scanResult.scanDurationMs}ms
                </span>
                {remediationBundle?.tokenUsage && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-emerald-300 tabular-nums">
                      {remediationBundle.tokenUsage.totalTokens.toLocaleString()} tokens (₹
                      {remediationBundle.tokenUsage.estimatedCostInr.toFixed(2)}/PR)
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={onOpenAuditor}
                className="text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <MessageSquareText className="w-3.5 h-3.5" />
                Ask AI Compliance Auditor
              </button>
            </div>
          )}
        </section>

        {/* Right 4 Columns: Risk Gauge + Findings Feed */}
        <div className="xl:col-span-4 space-y-5">
          <RiskGauge
            score={displayedRiskScore}
            hasScanned={Boolean(scanResult)}
            verification={remediationBundle?.verification ?? null}
            findingsCount={activeOpenLeaks}
            bypassCount={scanResult?.bypassAttempts.length ?? 0}
            appliedCommitSha={remediationBundle?.appliedCommitSha}
          />

          {/* Deterministic Findings List */}
          <section
            aria-label="Deterministic AST Findings"
            className="bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100 font-display">
                  Deterministic Findings
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Exact file:line data-flow sinks &amp; DPDP sections
                </p>
              </div>
              {scanResult && (
                <span className="text-xs font-mono tabular-nums text-slate-300">
                  {scanResult.findings.length} detected
                </span>
              )}
            </div>

            {!scanResult ? (
              <div className="p-6 text-center">
                <p className="text-xs text-slate-300 font-medium">
                  No AST scan run on this PR yet
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Click &ldquo;Run Deterministic Scan&rdquo; to inspect dynamic PII sinks, external LLM egress, and SQL retention schemas before spending any LLM tokens.
                </p>
                <button
                  type="button"
                  onClick={onRunScan}
                  className="mt-4 px-3.5 py-2 rounded-lg bg-[#1F2937] hover:bg-slate-700 text-xs font-semibold text-slate-100 inline-flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 text-cyan-400" />
                  Run Deterministic Scan
                </button>
              </div>
            ) : scanResult.findings.length === 0 ? (
              <div className="p-6 text-center">
                <ShieldCheck className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-emerald-300">
                  0 DPDP Violations Found
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  All scanned sinks and SQL schemas satisfy DPDP Sec 6, Sec 8(5), and Sec 8(7).
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#1F2937]">
                {scanResult.findings.map((finding) => {
                  const isRemediated = Boolean(remediationBundle?.verification.passed);
                  return (
                    <li key={finding.id}>
                      <button
                        type="button"
                        onClick={() => handleJumpFinding(finding)}
                        className="w-full text-left px-4 py-3.5 hover:bg-[#162033]/70 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                          <span className="text-cyan-300 truncate">
                            {finding.filePath}:{finding.line}
                          </span>
                          <span
                            className={`font-semibold shrink-0 ${
                              isRemediated ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isRemediated ? 'VERIFIED FIXED' : finding.severity}
                          </span>
                        </div>

                        <p className="text-xs font-medium text-slate-100 mt-1">
                          {finding.title}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-[11px] text-slate-400 font-mono">
                          <span className={isRemediated ? 'text-emerald-400' : 'text-red-300'}>
                            {finding.dpdpSection}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{finding.cweId}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {isRemediated ? '0 pts' : `+${finding.riskPoints} pts`}
                          </span>
                        </div>

                        {finding.bypassAttemptDetected && (
                          <p className="mt-1.5 text-[11px] text-amber-300/90">
                            Neutralized bypass at line {finding.bypassAttemptDetected.line}:{' '}
                            <code className="font-mono">{finding.bypassAttemptDetected.comment}</code>
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
