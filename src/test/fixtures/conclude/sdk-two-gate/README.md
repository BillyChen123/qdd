# QDD Conclude SDK Evaluation Fixture

This small fixture is deliberately versioned for behavior evaluation. It contains two closed studies, one promoted discovery report and table, one finalized but unpromoted spatial validation report and table, and one image that the agent must inspect through the multimodal `view_image` tool.

The fixture encodes evidence relationships, not a canonical manuscript. Scripted human feedback expresses editorial intent and the live evaluation keeps semantic observations separate from mechanical harness assertions.

Run the repeatable offline contract with:

```bash
npm run build
npm run eval:conclude -- --output /tmp/qdd-conclude-fake
```

Run the opt-in SDK behavior evaluation with:

```bash
npm run eval:conclude -- --live --output /tmp/qdd-conclude-live
```

The live command writes a `blocked` report and exits cleanly when the repository-supported Anthropic credential configuration is unavailable.
