import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  FileText,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { DPDP_2026_RULES, SKILL_MD_CONTENT } from '../data/dpdpData';
import { RemediationBundle, ScanResult } from '../types';

interface SkillInspectorProps {
  scanResult: ScanResult | null;
  remediationBundle: RemediationBundle | null;
}

export function SkillInspector({ scanResult, remediationBundle }: SkillInspectorProps) {
  const [ruleFilter, setRuleFilter] = useState<'all' | 'matched' | 'pruned'>('all');
  const [rulesView, setRulesView] = useState<'structured' | 'json'>('structured');
  const [activeLevel, setActiveLevel] = useState<1 | 2 | 3>(3);

  // If user hasn't scanned yet, default highlight to the 4 rules matched by PR #42 so the inspector is immediately informative
  const matchedIds = useMemo(() => {
    if (scanResult && scanResult.matchedRuleIds.length > 0) {
      return new Set(scanResult.matchedRuleIds);
    }
    return new Set([
      'DPDP-SEC-8-5-LOG',
      'DPDP-SEC-8-5-LLM-EGRESS',
      'DPDP-SEC-6-CONSENT',
      'DPDP-SEC-8-7-SQL',
    ]);
  }, [scanResult]);

  const tokenMetrics = useMemo(() => {
    const level1Tokens = 85;
    const level2Tokens = 420;
    const fullRulesTokens = DPDP_2026_RULES.reduce((sum, r) => sum + r.estimatedTokens, 0);
    const matchedRulesTokens = DPDP_2026_RULES.filter((r) => matchedIds.has(r.id)).reduce(
      (sum, r) => sum + r.estimatedTokens,
      0
    );
    const naiveFullRepoOverhead = 1150;
    const naiveTotal = level1Tokens + level2Tokens + fullRulesTokens + naiveFullRepoOverhead;
    const progressiveTotal =
      remediationBundle?.tokenUsage?.promptTokens ?? level1Tokens + level2Tokens + matchedRulesTokens;

    const savingsPct = Math.max(
      0,
      Math.round(((naiveTotal - progressiveTotal) / naiveTotal) * 1000) / 10
    );
    const costPerPr = remediationBundle?.tokenUsage?.estimatedCostInr ?? 0.3;

    return {
      level1Tokens,
      level2Tokens,
      matchedRulesTokens,
      naiveTotal,
      progressiveTotal,
      savingsPct,
      costPerPr,
      matchedCount: matchedIds.size,
      totalCount: DPDP_2026_RULES.length,
    };
  }, [matchedIds, remediationBundle]);

  const filteredRules = useMemo(() => {
    if (ruleFilter === 'matched') {
      return DPDP_2026_RULES.filter((r) => matchedIds.has(r.id));
    }
    if (ruleFilter === 'pruned') {
      return DPDP_2026_RULES.filter((r) => !matchedIds.has(r.id));
    }
    return DPDP_2026_RULES;
  }, [ruleFilter, matchedIds]);

  return (
    <div className="space-y-6">
      {/* Header + Live Token Savings Strip */}
      <section className="bg-[#111827] border border-[#1F2937] rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#1F2937]">
          <div>
            <h1 className="text-lg font-semibold text-slate-100 font-display">
              Progressive Disclosure Architecture &amp; DPDP Ruleset
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Deterministic AST scanning isolates exact tainted sinks before Gemini ever runs, pruning dormant statutory clauses and shrinking context by ~75% per Pull Request.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 shrink-0 bg-[#0B0F19] border border-[#1F2937] rounded-lg px-4 py-3">
            <div>
              <p className="text-[11px] text-slate-400">Token Reduction</p>
              <p className="text-lg font-mono font-bold tabular-nums text-emerald-400 mt-0.5">
                ~{tokenMetrics.savingsPct}%
              </p>
            </div>
            <div className="border-x border-[#1F2937] px-4">
              <p className="text-[11px] text-slate-400">Prompt Payload</p>
              <p className="text-lg font-mono font-bold tabular-nums text-cyan-300 mt-0.5">
                {tokenMetrics.progressiveTotal.toLocaleString()}
              </p>
              <p className="text-[10px] font-mono text-slate-500 tabular-nums">
                vs {tokenMetrics.naiveTotal.toLocaleString()} naive
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Cost per PR</p>
              <p className="text-lg font-mono font-bold tabular-nums text-slate-100 mt-0.5">
                ₹{tokenMetrics.costPerPr.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* 3-Level Progressive Disclosure Visual Flow */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              level: 1 as const,
              title: 'Level 1 · YAML Router Metadata',
              tokens: tokenMetrics.level1Tokens,
              status: 'Always Resident',
              desc: 'Lightweight glob & jurisdiction manifest. Triggers auditor skill only when Python, TypeScript, or SQL schema diffs touch PII.',
              accent: 'text-slate-200',
            },
            {
              level: 2 as const,
              title: 'Level 2 · SKILL.md SOP Trigger',
              tokens: tokenMetrics.level2Tokens,
              status: 'Loaded on PR Match',
              desc: 'Enforces deterministic AST pre-scan, prompt-injection neutralization (# sentinel-ignore), and XML <code_slice> extraction.',
              accent: 'text-cyan-300',
            },
            {
              level: 3 as const,
              title: 'Level 3 · AST Script + Matched Rules Only',
              tokens: tokenMetrics.matchedRulesTokens,
              status: `${tokenMetrics.matchedCount}/${tokenMetrics.totalCount} Rules Injected`,
              desc: `Prunes ${tokenMetrics.totalCount - tokenMetrics.matchedCount} irrelevant DPDP rules (child data, cross-border, SDF DPIA) before invoking Gemini structured synthesis.`,
              accent: 'text-emerald-300',
            },
          ].map((item, index) => {
            const isSelected = activeLevel === item.level;
            return (
              <button
                key={item.level}
                type="button"
                onClick={() => setActiveLevel(item.level)}
                className={`text-left p-4 rounded-xl border transition-colors relative ${
                  isSelected
                    ? 'bg-[#0E1729] border-cyan-500/50'
                    : 'bg-[#0B0F19] border-[#1F2937] hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                  <span className={item.accent}>{item.status}</span>
                  <span className="text-slate-400 tabular-nums">~{item.tokens} tok</span>
                </div>
                <p className="text-sm font-semibold text-slate-100 mt-1.5 font-display flex items-center gap-2">
                  <span>{item.title}</span>
                  {index < 2 && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 hidden md:inline shrink-0" />
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Split Inspector: Left SKILL.md, Right dpdp_2026_rules.json */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Live SKILL.md Inspector */}
        <section className="xl:col-span-5 bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1F2937] bg-[#0E1422] flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-mono text-xs text-slate-200 truncate">
                .agent/skills/dpdp-compliance-auditor/SKILL.md
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              Level {activeLevel} Focus
            </span>
          </div>

          <div className="p-4 bg-[#0B0F19] max-h-[560px] overflow-y-auto font-mono text-xs leading-6">
            {SKILL_MD_CONTENT.split('\n').map((line, i) => {
              const lineNum = i + 1;
              const isFrontmatter = lineNum <= 12;
              const isLevel2 = lineNum >= 14 && lineNum <= 25;
              const isLevel3 = lineNum >= 26;

              const highlighted =
                (activeLevel === 1 && isFrontmatter) ||
                (activeLevel === 2 && isLevel2) ||
                (activeLevel === 3 && isLevel3);

              return (
                <div
                  key={lineNum}
                  className={`flex px-1 rounded ${
                    highlighted ? 'bg-cyan-500/10 text-slate-100' : 'text-slate-400'
                  }`}
                >
                  <span className="w-8 shrink-0 select-none text-right pr-2.5 text-slate-600 tabular-nums">
                    {lineNum}
                  </span>
                  <pre className="whitespace-pre-wrap break-words">{line || ' '}</pre>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: dpdp_2026_rules.json Interactive Catalog */}
        <section className="xl:col-span-7 bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1F2937] bg-[#0E1422] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-xs text-slate-200">dpdp_2026_rules.json</span>
              <span className="text-xs text-slate-500" aria-hidden="true">·</span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {tokenMetrics.matchedCount} active / {tokenMetrics.totalCount} total
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tabs */}
              <div className="inline-flex bg-[#0B0F19] border border-[#1F2937] rounded-lg p-0.5 text-[11px]">
                {(
                  [
                    ['all', `All (${DPDP_2026_RULES.length})`],
                    ['matched', `Injected (${tokenMetrics.matchedCount})`],
                    ['pruned', `Pruned (${DPDP_2026_RULES.length - tokenMetrics.matchedCount})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRuleFilter(key)}
                    className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                      ruleFilter === key
                        ? 'bg-[#1F2937] text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setRulesView((v) => (v === 'structured' ? 'json' : 'structured'))
                }
                className="px-2.5 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] hover:border-slate-600 text-[11px] font-mono text-slate-300 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                {rulesView === 'structured' ? 'View Raw JSON' : 'Structured View'}
              </button>
            </div>
          </div>

          {rulesView === 'json' ? (
            <pre className="p-4 bg-[#0B0F19] max-h-[560px] overflow-auto font-mono text-xs text-slate-300 leading-5">
              {JSON.stringify(
                {
                  schema_version: '2026.2',
                  statute: 'India Digital Personal Data Protection Act, 2023 & Rules 2026',
                  progressive_disclosure: {
                    active_rule_ids: Array.from(matchedIds),
                    pruned_rule_count: DPDP_2026_RULES.length - matchedIds.size,
                    token_reduction_pct: tokenMetrics.savingsPct,
                  },
                  rules: filteredRules,
                },
                null,
                2
              )}
            </pre>
          ) : (
            <div className="divide-y divide-[#1F2937] max-h-[560px] overflow-y-auto bg-[#0B0F19]">
              {filteredRules.map((rule) => {
                const isInjected = matchedIds.has(rule.id);
                return (
                  <div
                    key={rule.id}
                    className={`p-4 transition-colors ${
                      isInjected ? 'bg-cyan-500/[0.04]' : 'opacity-75'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                      <div className="flex items-center gap-2">
                        {isInjected ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        )}
                        <span className={isInjected ? 'text-cyan-300 font-semibold' : 'text-slate-400'}>
                          {rule.id}
                        </span>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span className="text-slate-300">{rule.dpdpSection}</span>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span className="text-slate-400">{rule.cweId}</span>
                      </div>

                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-amber-300/90">{rule.maxPenaltyInr}</span>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span className={isInjected ? 'text-emerald-400' : 'text-slate-500'}>
                          {isInjected
                            ? `Injected (${rule.estimatedTokens} tok)`
                            : `Pruned (saved ${rule.estimatedTokens} tok)`}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xs font-semibold text-slate-100 mt-1.5">{rule.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rule.summary}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-2">
                      AST Sink: <span className="text-slate-300">{rule.astPatterns[0]}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
