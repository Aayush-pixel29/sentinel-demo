import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Cpu,
  GitBranch,
  Lock,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { PlanTier } from '../types';

interface GitHubOnboardingProps {
  activePlan: PlanTier;
  onSelectPlan: (plan: PlanTier) => void;
}

const SAMPLE_REPOS = [
  { name: 'fintech-india/demo_vulnerable_app', stack: 'Python · FastAPI · PostgreSQL', connected: true },
  { name: 'fintech-india/kyc-core-api', stack: 'Python · Pydantic · Redis', connected: false },
  { name: 'fintech-india/payments-ledger', stack: 'TypeScript · Express · Postgres', connected: false },
];

const PRICING_PLANS: Array<{
  id: PlanTier;
  name: string;
  audience: string;
  price: string;
  cadence: string;
  highlight?: boolean;
  limits: Array<{ label: string; value: string }>;
}> = [
  {
    id: 'free',
    name: 'Free',
    audience: 'For solo builders & open-source',
    price: '₹0',
    cadence: 'forever',
    limits: [
      { label: 'Repositories', value: '1 GitHub repo' },
      { label: 'PR Scans', value: '50 AST scans / mo' },
      { label: 'Ruleset', value: 'DPDP Sec 6, 8(5), 8(7)' },
      { label: 'Auto-Remediation', value: 'Manual patch preview' },
    ],
  },
  {
    id: 'startup-pro',
    name: 'Startup Pro',
    audience: 'For scaling fintech & AI startups',
    price: '₹1,999',
    cadence: '/ month flat',
    highlight: true,
    limits: [
      { label: 'Repositories', value: 'Up to 10 repos · Unlimited devs' },
      { label: 'PR Scans & Fixes', value: 'Unlimited Verified Fix PRs' },
      { label: 'AI Compliance Auditor', value: 'Voice + Text Q&A + Sec 8(5) Reports' },
      { label: 'Branch Protection', value: 'Required sentinel-dpdp/verify gate' },
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    audience: 'For multi-client & regulated orgs',
    price: '₹7,999',
    cadence: '/ month flat',
    limits: [
      { label: 'Repositories', value: 'Unlimited orgs & repos' },
      { label: 'Runtime Guardrail', value: 'In-VPC Gemma Sidecar (<15ms PII)' },
      { label: 'Custom Policy Packs', value: 'RBI, SEBI, NPCI & custom YAML rules' },
      { label: 'Telemetry Sink', value: 'Live BigQuery & SIEM export' },
    ],
  },
];

export function GitHubOnboarding({ activePlan, onSelectPlan }: GitHubOnboardingProps) {
  const [connectedRepos, setConnectedRepos] = useState<string[]>([
    'fintech-india/demo_vulnerable_app',
  ]);
  const [customRepoInput, setCustomRepoInput] = useState('');
  const [branchProtection, setBranchProtection] = useState(true);
  const [gemmaSidecar, setGemmaSidecar] = useState(true);

  const toggleRepo = (repoName: string) => {
    setConnectedRepos((prev) =>
      prev.includes(repoName) ? prev.filter((r) => r !== repoName) : [...prev, repoName]
    );
  };

  const handleAddCustomRepo = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customRepoInput.trim().replace(/^https?:\/\/github\.com\//, '');
    if (!cleaned) return;
    if (!connectedRepos.includes(cleaned)) {
      setConnectedRepos((prev) => [...prev, cleaned]);
    }
    setCustomRepoInput('');
  };

  const generatedWorkflowYaml = `name: Sentinel-DPDP Compliance Gate
on:
  pull_request:
    branches: [main, release/*]

jobs:
  sentinel-dpdp-verify:
    name: sentinel-dpdp/verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sentinel-dpdp/pr-guardian-action@v2
        with:
          ruleset: dpdp_2026_rules.json
          block_on_violation: ${branchProtection ? 'true' : 'false'}
          ignore_prompt_injection_comments: true
          gemma_in_vpc_sidecar: ${gemmaSidecar ? 'enabled (<15ms p99)' : 'disabled'}
          required_status_check: ${branchProtection ? 'sentinel-dpdp/verify' : 'advisory-only'}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 font-display">
            GitHub App Onboarding &amp; Guardrail Policy
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Connect repositories, enforce required merge gates, and deploy the In-VPC Gemma PII redaction sidecar in under 2 minutes.
          </p>
        </div>
        <div className="text-xs font-mono text-emerald-400 flex items-center gap-2 shrink-0">
          <CheckCircle2 className="w-4 h-4" />
          <span>{connectedRepos.length} repository connected</span>
        </div>
      </section>

      {/* Interactive 2-Column Onboarding Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left 7 Cols: Repo Connection + Guardrail Toggles */}
        <div className="xl:col-span-7 space-y-5">
          {/* Step 1: Connect GitHub Repository */}
          <section className="bg-[#111827] border border-[#1F2937] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-slate-100 font-display">
                  01. Connect GitHub Repository
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                GitHub App · Read Code &amp; Write PR Checks
              </span>
            </div>

            <div className="divide-y divide-[#1F2937] border border-[#1F2937] rounded-lg overflow-hidden bg-[#0B0F19]">
              {[
                ...SAMPLE_REPOS,
                ...connectedRepos
                  .filter((r) => !SAMPLE_REPOS.some((sr) => sr.name === r))
                  .map((name) => ({ name, stack: 'Custom GitHub Repository', connected: true })),
              ].map((repo) => {
                const isConnected = connectedRepos.includes(repo.name);
                return (
                  <div
                    key={repo.name}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-slate-100 truncate">{repo.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{repo.stack}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleRepo(repo.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                        isConnected
                          ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                          : 'bg-[#1F2937] hover:bg-slate-700 text-slate-100'
                      }`}
                    >
                      {isConnected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Connected
                        </>
                      ) : (
                        'Connect Repo'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleAddCustomRepo} className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={customRepoInput}
                onChange={(e) => setCustomRepoInput(e.target.value)}
                placeholder="org/repository-name (e.g. acme-fintech/kyc-service)"
                className="flex-1 bg-[#0B0F19] border border-[#1F2937] focus:border-cyan-500 focus:outline-none rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-[#1F2937] hover:bg-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                Add Repo
              </button>
            </form>
          </section>

          {/* Step 2: Guardrail Toggles */}
          <section className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100 font-display">
              02. Merge Gate &amp; Runtime Privacy Controls
            </h2>

            {/* Toggle 1: Branch Protection */}
            <div className="p-4 rounded-lg bg-[#0B0F19] border border-[#1F2937] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-100">
                    Require <code className="font-mono text-cyan-300">sentinel-dpdp/verify</code> Branch Protection
                  </p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Blocks GitHub PR merges whenever deterministic AST risk score &gt; 0 or when <code className="font-mono text-slate-300">verify_patch.py</code> fails.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={branchProtection}
                aria-label="Toggle sentinel-dpdp/verify branch protection"
                onClick={() => setBranchProtection((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                  branchProtection ? 'bg-cyan-400' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                    branchProtection ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: In-VPC Gemma Sidecar */}
            <div className="p-4 rounded-lg bg-[#0B0F19] border border-[#1F2937] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Cpu className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-100">
                    Enable In-VPC Gemma Sidecar (&lt;15ms PII Redaction)
                  </p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Injects a quantized local Gemma 2B/4B container inside your AWS Mumbai (<code className="font-mono text-slate-300">ap-south-1</code>) or GCP Delhi VPC to scrub PAN, Aadhaar, and phone numbers before external LLM calls.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={gemmaSidecar}
                aria-label="Toggle In-VPC Gemma Sidecar"
                onClick={() => setGemmaSidecar((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                  gemmaSidecar ? 'bg-emerald-400' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                    gemmaSidecar ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>
        </div>

        {/* Right 5 Cols: Live Generated CI Workflow & Sidecar Config */}
        <section className="xl:col-span-5 bg-[#111827] border border-[#1F2937] rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#1F2937] bg-[#0E1422] flex items-center justify-between">
            <span className="font-mono text-xs text-slate-200">
              .github/workflows/sentinel-dpdp.yml
            </span>
            <span className="text-[11px] font-mono text-cyan-300">Live Config Preview</span>
          </div>

          <pre className="p-4 bg-[#0B0F19] font-mono text-xs text-slate-300 leading-6 overflow-x-auto flex-1">
            {generatedWorkflowYaml}
          </pre>

          <div className="px-4 py-3 border-t border-[#1F2937] bg-[#0E1422] text-xs text-slate-400 flex items-center justify-between gap-2">
            <span>Status Check Enforcement</span>
            <span
              className={`font-mono font-semibold ${
                branchProtection ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {branchProtection ? 'REQUIRED ON MAIN' : 'ADVISORY MODE'}
            </span>
          </div>
        </section>
      </div>

      {/* Step 3: Pricing Cards */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-100 font-display">
              03. Transparent Flat-Team Pricing (INR)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero per-seat tax. Predictable compliance infrastructure engineered for Indian fintech and SaaS teams.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {PRICING_PLANS.map((plan) => {
            const isActive = activePlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`rounded-xl p-5 border flex flex-col justify-between transition-colors ${
                  isActive
                    ? 'bg-[#111C2E] border-cyan-500/60'
                    : 'bg-[#111827] border-[#1F2937]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-100 font-display">
                      {plan.name}
                    </h3>
                    {isActive && (
                      <span className="text-[11px] font-mono font-semibold text-cyan-300">
                        Active Plan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{plan.audience}</p>

                  <div className="mt-4 pb-4 border-b border-[#1F2937] flex items-baseline gap-1.5">
                    <span className="text-3xl font-mono font-bold tabular-nums text-slate-50">
                      {plan.price}
                    </span>
                    <span className="text-xs text-slate-400">{plan.cadence}</span>
                  </div>

                  <dl className="mt-4 space-y-2.5 text-xs">
                    {plan.limits.map((lim) => (
                      <div key={lim.label} className="flex items-baseline justify-between gap-3">
                        <dt className="text-slate-400">{lim.label}</dt>
                        <dd className="text-slate-200 font-medium text-right">{lim.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectPlan(plan.id)}
                  className={`mt-6 w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    isActive
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                      : plan.highlight
                        ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                        : 'bg-[#1F2937] hover:bg-slate-700 text-slate-100'
                  }`}
                >
                  {isActive ? (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Current Plan Selected
                    </>
                  ) : (
                    `Switch to ${plan.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
