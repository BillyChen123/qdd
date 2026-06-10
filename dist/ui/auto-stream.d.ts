import type { AutoResult, AutoRunEvents } from '../runtime/orchestrator.js';
interface OutputStream {
    columns?: number;
    isTTY?: boolean;
    write(chunk: string): boolean;
}
export interface AutoConsoleRendererOptions {
    stdout?: OutputStream;
    color?: boolean;
    verbose?: boolean;
}
export declare class AutoConsoleRenderer {
    readonly events: AutoRunEvents;
    private readonly stdout;
    private readonly useColor;
    private readonly useSpinner;
    private readonly verbose;
    private headerPrinted;
    private phaseCount;
    private textBuffer;
    private assistantAtLineStart;
    private assistantWrote;
    private spinnerTimer;
    private spinnerFrameIndex;
    private spinnerText;
    private currentCompactAction;
    private modelPreviewBuffer;
    private lastModelNote;
    private phaseFailures;
    private phaseWrites;
    private logPath;
    private projectRoot;
    constructor(options?: AutoConsoleRendererOptions);
    finish(result: AutoResult): void;
    private runStart;
    private phaseStart;
    private phaseResult;
    private field;
    private line;
    private write;
    private writeRaw;
    private writeWithSpinnerCleared;
    private writeAssistantDelta;
    private observeModelDelta;
    private modelNote;
    private extractModelNote;
    private endAssistantText;
    private writeAssistantText;
    private writeAssistantSegment;
    private describeTool;
    private describeToolResult;
    private describeCompactAction;
    private compactAction;
    private describeFailure;
    private bold;
    private title;
    private dim;
    private blue;
    private cyan;
    private magenta;
    private green;
    private yellow;
    private red;
    private paint;
    private openLog;
    private logLine;
    private logBlock;
    private startSpinner;
    private updateSpinner;
    private stopSpinner;
    private renderSpinner;
    private formatSpinnerFrame;
    private termWidth;
    private truncate;
    private relativeLogPath;
}
export declare function createAutoConsoleRenderer(options?: AutoConsoleRendererOptions): AutoConsoleRenderer;
export {};
//# sourceMappingURL=auto-stream.d.ts.map