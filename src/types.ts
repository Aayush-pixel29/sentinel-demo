export type ActiveTab = 'control-plane' | 'skill-inspector' | 'telemetry' | 'onboarding';

export type CodeLanguage = 'python' | 'typescript' | 'sql';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface PRFile {
  path: string;
  language: CodeLanguage;
  content: string;
  description: string;
}

export interface DPDPFinding {
  id: string;
  ruleId: string;
  filePath: string;
  line: number;
  column: number;
  snippet: string;
  dpdpSection: string;
  cweId: string;
  severity: Severity;
  riskPoints: number;
  title: string;
  description: string;
  sinkType: 'logging_sink' | 'llm_egress' | 'missing_consent' | 'sql_retention';
  taintedFields: string[];
  bypassAttemptDetected?: {
    line: number;
    comment: string;
  };
}

export interface ScanResult {
  prId: string;
  repoName: string;
  scannedAt: string;
  scanDurationMs: number;
  findings: DPDPFinding[];
  bypassAttempts: Array<{
    filePath: string;
    line: number;
    comment: string;
  }>;
  riskScore: number;
  status: 'BLOCKED' | 'SAFE';
  matchedRuleIds: string[];
  codeSlicesXml: string;
}

export interface RemediationItem {
  file_path: string;
  dpdp_section: string;
  cwe_id: string;
  explanation: string;
  patched_code: string;
  unified_diff: string;
  gemma_sidecar_snippet: string;
}

export interface VerificationResult {
  passed: boolean;
  remainingFindings: DPDPFinding[];
  postPatchRiskScore: number;
  verifiedAt: string;
  verificationDurationMs: number;
  filesVerified: number;
  checksRun: number;
}

export interface RemediationBundle {
  remediations: RemediationItem[];
  verification: VerificationResult;
  tokenUsage?: {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostInr: number;
  };
  appliedCommitSha?: string;
}

export interface DPDPRule {
  id: string;
  dpdpSection: string;
  title: string;
  cweId: string;
  severity: Severity;
  maxPenaltyInr: string;
  appliesTo: CodeLanguage[];
  summary: string;
  astPatterns: string[];
  requiredControls: string[];
  remediationGuidance: string;
  estimatedTokens: number;
}

export interface AuditorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Array<{
    fileLine: string;
    dpdpSection: string;
  }>;
}

export interface TelemetryRun {
  id: string;
  timestamp: string;
  repo: string;
  prNumber: string;
  branch: string;
  findingsCount: number;
  initialRisk: number;
  finalRisk: number;
  dpdpSections: string[];
  gateStatus: 'PASSED' | 'BLOCKED';
  tokensUsed: number;
  costInr: number;
  latencyMs: number;
}

export type PlanTier = 'free' | 'startup-pro' | 'agency';
