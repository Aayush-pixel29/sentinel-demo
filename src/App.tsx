import { useCallback, useMemo, useState } from 'react';
import { MessageSquareText, Shield } from 'lucide-react';
import { AuditorDrawer } from './components/AuditorDrawer';
import { ComplianceTelemetry } from './components/ComplianceTelemetry';
import { GitHubOnboarding } from './components/GitHubOnboarding';
import { PRControlPlane, PipelineStep } from './components/PRControlPlane';
import { SkillInspector } from './components/SkillInspector';
import {
  CUSTOM_CODE_PRESETS,
  DPDP_2026_RULES,
  INITIAL_TELEMETRY_RUNS,
  SAMPLE_PR_FILES,
  SAMPLE_PR_META,
} from './data/dpdpData';
import { runDeterministicScan, runVerificationGate } from './engine/scanner';
import {
  ActiveTab,
  CodeLanguage,
  PRFile,
  PlanTier,
  RemediationBundle,
  RemediationItem,
  ScanResult,
  TelemetryRun,
} from './types';

const NAV_TABS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'control-plane', label: 'PR Control Plane' },
  { id: 'skill-inspector', label: 'SKILL.md & Rules' },
  { id: 'telemetry', label: 'Compliance & Telemetry' },
  { id: 'onboarding', label: 'GitHub Onboarding' },
];

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free · ₹0/mo',
  'startup-pro': 'Startup Pro · ₹1,999/mo',
  agency: 'Agency · ₹7,999/mo',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('control-plane');
  const [activePlan, setActivePlan] = useState<PlanTier>('startup-pro');
  const [isAuditorOpen, setIsAuditorOpen] = useState(false);

  // PR Control Plane State
  const [mode, setMode] = useState<'sample' | 'custom'>('sample');
  const [sampleFiles, setSampleFiles] = useState<PRFile[]>(SAMPLE_PR_FILES);
  const [activeFilePath, setActiveFilePath] = useState<string>(SAMPLE_PR_FILES[0].path);

  const [customLanguage, setCustomLanguage] = useState<CodeLanguage>('python');
  const [customCode, setCustomCode] = useState<string>(CUSTOM_CODE_PRESETS.python.code);

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [remediationBundle, setRemediationBundle] = useState<RemediationBundle | null>(null);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>(0);
  const [isRemediating, setIsRemediating] = useState(false);
  const [remediationError, setRemediationError] = useState<string | null>(null);
  const [highlightedLine, setHighlightedLine] = useState<{
    filePath: string;
    line: number;
  } | null>(null);

  const [telemetryRuns, setTelemetryRuns] = useState<TelemetryRun[]>(INITIAL_TELEMETRY_RUNS);

  const activeFiles: PRFile[] = useMemo(() => {
    if (mode === 'sample') return sampleFiles;
    const preset = CUSTOM_CODE_PRESETS[customLanguage];
    return [
      {
        path: preset.path,
        language: customLanguage,
        content: customCode,
        description: `Custom ${preset.label} snippet`,
      },
    ];
  }, [mode, sampleFiles, customLanguage, customCode]);

  const currentPrMeta = useMemo(
    () =>
      mode === 'sample'
        ? { prId: SAMPLE_PR_META.prId, repoName: SAMPLE_PR_META.repoName }
        : { prId: 'Sandbox', repoName: 'custom-snippet/' },
    [mode]
  );

  const upsertTelemetryRun = useCallback((run: TelemetryRun) => {
    setTelemetryRuns((prev) => [run, ...prev.filter((r) => r.id !== run.id)]);
  }, []);

  const handleModeChange = (nextMode: 'sample' | 'custom') => {
    setMode(nextMode);
    setScanResult(null);
    setRemediationBundle(null);
    setPipelineStep(0);
    setRemediationError(null);
    setHighlightedLine(null);
    if (nextMode === 'sample') {
      setActiveFilePath(sampleFiles[0].path);
    } else {
      setActiveFilePath(CUSTOM_CODE_PRESETS[customLanguage].path);
    }
  };

  const handleCustomLanguageChange = (lang: CodeLanguage) => {
    setCustomLanguage(lang);
    setCustomCode(CUSTOM_CODE_PRESETS[lang].code);
    setActiveFilePath(CUSTOM_CODE_PRESETS[lang].path);
    setScanResult(null);
    setRemediationBundle(null);
    setPipelineStep(0);
    setRemediationError(null);
  };

  const handleResetDemo = () => {
    setSampleFiles(SAMPLE_PR_FILES);
    if (mode === 'sample') {
      setActiveFilePath(SAMPLE_PR_FILES[0].path);
    } else {
      setCustomCode(CUSTOM_CODE_PRESETS[customLanguage].code);
    }
    setScanResult(null);
    setRemediationBundle(null);
    setPipelineStep(0);
    setRemediationError(null);
    setHighlightedLine(null);
  };

  // Step 1: Deterministic AST Scan
  const handleRunScan = () => {
    setRemediationError(null);
    setRemediationBundle(null);
    const result = runDeterministicScan(activeFiles, currentPrMeta);
    setScanResult(result);
    setPipelineStep(1);

    if (result.findings.length > 0) {
      setActiveFilePath(result.findings[0].filePath);
    }

    upsertTelemetryRun({
      id: `live-${currentPrMeta.prId}`,
      timestamp: 'Just now (Live)',
      repo:
        mode === 'sample' ? 'fintech-india/demo_vulnerable_app' : 'sandbox/custom-snippet',
      prNumber: currentPrMeta.prId,
      branch: mode === 'sample' ? SAMPLE_PR_META.headBranch : `custom/${customLanguage}`,
      findingsCount: result.findings.length,
      initialRisk: result.riskScore,
      finalRisk: result.riskScore,
      dpdpSections: Array.from(new Set(result.findings.map((f) => f.dpdpSection))),
      gateStatus: result.findings.length === 0 ? 'PASSED' : 'BLOCKED',
      tokensUsed: 0,
      costInr: 0,
      latencyMs: result.scanDurationMs,
    });
  };

  // Step 2: Progressive Disclosure + Gemini Auto-Remediation + Verification Gate
  const handleGenerateFixPR = async (verificationFeedback?: string) => {
    if (!scanResult || scanResult.findings.length === 0) return;

    setIsRemediating(true);
    setRemediationError(null);
    setPipelineStep(2); // 2. Loading Matched DPDP Rules

    const startedAt = performance.now();

    try {
      const matchedRules = DPDP_2026_RULES.filter((r) =>
        scanResult.matchedRuleIds.includes(r.id)
      ).map((r) => ({
        id: r.id,
        dpdpSection: r.dpdpSection,
        title: r.title,
        cweId: r.cweId,
        remediationGuidance: r.remediationGuidance,
        requiredControls: r.requiredControls,
      }));

      // Short intentional visual transition so user sees Stage 2 -> Stage 3 clearly
      await new Promise((resolve) => setTimeout(resolve, 260));
      setPipelineStep(3); // 3. Gemini Patch Synthesis

      const response = await fetch('/api/remediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: activeFiles.map((f) => ({
            path: f.path,
            language: f.language,
            content: f.content,
          })),
          findings: scanResult.findings.map((f) => ({
            filePath: f.filePath,
            line: f.line,
            dpdpSection: f.dpdpSection,
            cweId: f.cweId,
            title: f.title,
            description: f.description,
            sinkType: f.sinkType,
          })),
          matchedRules,
          codeSlicesXml: scanResult.codeSlicesXml,
          verificationFeedback,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Gemini patch synthesis failed.');
      }

      const remediations = (payload.remediations ?? []) as RemediationItem[];
      if (remediations.length === 0) {
        throw new Error('Gemini returned no file remediations.');
      }

      setPipelineStep(4); // 4. Verification Gate
      await new Promise((resolve) => setTimeout(resolve, 180));

      const patchedMap: Record<string, string> = {};
      remediations.forEach((item) => {
        patchedMap[item.file_path] = item.patched_code;
      });

      const verification = runVerificationGate(activeFiles, patchedMap, currentPrMeta);

      const bundle: RemediationBundle = {
        remediations,
        verification,
        tokenUsage: payload.tokenUsage,
      };
      setRemediationBundle(bundle);

      const totalLatencyMs = Math.round(performance.now() - startedAt);
      upsertTelemetryRun({
        id: `live-${currentPrMeta.prId}`,
        timestamp: 'Just now (Live)',
        repo:
          mode === 'sample' ? 'fintech-india/demo_vulnerable_app' : 'sandbox/custom-snippet',
        prNumber: currentPrMeta.prId,
        branch: mode === 'sample' ? SAMPLE_PR_META.headBranch : `custom/${customLanguage}`,
        findingsCount: scanResult.findings.length,
        initialRisk: scanResult.riskScore,
        finalRisk: verification.postPatchRiskScore,
        dpdpSections: Array.from(new Set(scanResult.findings.map((f) => f.dpdpSection))),
        gateStatus: verification.passed ? 'PASSED' : 'BLOCKED',
        tokensUsed: payload.tokenUsage?.totalTokens ?? 1120,
        costInr: payload.tokenUsage?.estimatedCostInr ?? 0.3,
        latencyMs: totalLatencyMs,
      });
    } catch (err) {
      setRemediationError(
        err instanceof Error ? err.message : 'Unexpected error during remediation.'
      );
      setPipelineStep(1);
    } finally {
      setIsRemediating(false);
    }
  };

  // 1-Click Apply PR Commit
  const handleApplyCommit = () => {
    if (!remediationBundle || !remediationBundle.verification.passed) return;

    const commitSha = `8f4c${Math.floor(100 + Math.random() * 899)}`;
    const patchedMap = new Map(
      remediationBundle.remediations.map((r) => [r.file_path, r.patched_code])
    );

    if (mode === 'sample') {
      setSampleFiles((prev) =>
        prev.map((file) =>
          patchedMap.has(file.path)
            ? { ...file, content: patchedMap.get(file.path)! }
            : file
        )
      );
    } else {
      const targetPath = CUSTOM_CODE_PRESETS[customLanguage].path;
      const updated = patchedMap.get(targetPath);
      if (updated) setCustomCode(updated);
    }

    setRemediationBundle((prev) =>
      prev ? { ...prev, appliedCommitSha: commitSha } : prev
    );
  };

  const handleJumpToLocation = (fileLine: string) => {
    const [filePath, lineStr] = fileLine.split(':');
    const lineNum = Number.parseInt(lineStr ?? '1', 10);
    const exists = activeFiles.some((f) => f.path === filePath);
    if (exists) {
      setActiveTab('control-plane');
      setActiveFilePath(filePath);
      if (!Number.isNaN(lineNum)) {
        setHighlightedLine({ filePath, line: lineNum });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/95 backdrop-blur-md border-b border-[#1F2937]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark + Shield Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center">
              <Shield className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-50 font-display whitespace-nowrap">
              Sentinel-DPDP
            </span>
          </div>

          {/* Zone 2: 4 Primary Navigation Tabs (Desktop) */}
          <nav
            aria-label="Primary Workspace Navigation"
            className="hidden lg:flex items-center gap-1"
          >
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#111827] text-cyan-300 border border-[#1F2937]'
                      : 'text-slate-400 hover:text-slate-100 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Engine Status, Plan Metadata & Primary Auditor CTA */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden xl:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
              <span className="text-emerald-400 font-medium">Neuro-Symbolic Engine Active</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => setActiveTab('onboarding')}
                className="font-mono text-slate-300 hover:text-cyan-300 transition-colors"
              >
                {PLAN_LABELS[activePlan]}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsAuditorOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              Ask AI Auditor
            </button>
          </div>
        </div>

        {/* Compact Mobile / Tablet Navigation Bar */}
        <nav
          aria-label="Mobile Workspace Navigation"
          className="lg:hidden border-t border-[#1F2937] px-4 py-1.5 flex items-center gap-1 overflow-x-auto"
        >
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#111827] text-cyan-300 border border-[#1F2937]'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'control-plane' && (
          <PRControlPlane
            mode={mode}
            onModeChange={handleModeChange}
            files={activeFiles}
            activeFilePath={activeFilePath}
            onSelectFile={setActiveFilePath}
            customLanguage={customLanguage}
            onCustomLanguageChange={handleCustomLanguageChange}
            customCode={customCode}
            onCustomCodeChange={setCustomCode}
            scanResult={scanResult}
            remediationBundle={remediationBundle}
            pipelineStep={pipelineStep}
            isRemediating={isRemediating}
            remediationError={remediationError}
            onRunScan={handleRunScan}
            onGenerateFixPR={handleGenerateFixPR}
            onApplyCommit={handleApplyCommit}
            onResetDemo={handleResetDemo}
            onOpenAuditor={() => setIsAuditorOpen(true)}
            highlightedLine={highlightedLine}
          />
        )}

        {activeTab === 'skill-inspector' && (
          <SkillInspector
            scanResult={scanResult}
            remediationBundle={remediationBundle}
          />
        )}

        {activeTab === 'telemetry' && (
          <ComplianceTelemetry
            telemetryRuns={telemetryRuns}
            scanResult={scanResult}
            remediationBundle={remediationBundle}
          />
        )}

        {activeTab === 'onboarding' && (
          <GitHubOnboarding
            activePlan={activePlan}
            onSelectPlan={setActivePlan}
          />
        )}
      </main>

      {/* Slide-Over AI Compliance Auditor Drawer */}
      <AuditorDrawer
        isOpen={isAuditorOpen}
        onClose={() => setIsAuditorOpen(false)}
        scanResult={scanResult}
        remediationBundle={remediationBundle}
        prMeta={currentPrMeta}
        onJumpToLocation={handleJumpToLocation}
      />
    </div>
  );
}
