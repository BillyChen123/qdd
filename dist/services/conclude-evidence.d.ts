import type { ConcludeEvidenceDossier, ConcludeEvidenceDossierAudit, ConcludePreflightResult } from '../types.js';
export declare const CONCLUDE_EVIDENCE_READ_LIMITS: {
    readonly maxBytesPerTextSource: number;
    readonly maxRowsPerTable: 5000;
    readonly maxEvidenceUnitsPerSource: 24;
};
export declare function auditConcludeEvidenceDossier(dossier: Omit<ConcludeEvidenceDossier, 'audit'> | ConcludeEvidenceDossier): ConcludeEvidenceDossierAudit;
export declare function buildConcludeEvidenceDossier(result: ConcludePreflightResult, now?: Date): Promise<ConcludeEvidenceDossier>;
export declare function renderConcludeEvidenceDossierMarkdown(dossier: ConcludeEvidenceDossier): string;
//# sourceMappingURL=conclude-evidence.d.ts.map