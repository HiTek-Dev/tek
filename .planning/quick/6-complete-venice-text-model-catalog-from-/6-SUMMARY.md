---
phase: quick-6
status: complete
started: 2026-02-18T23:52:11Z
completed: 2026-02-18T23:55:00Z
---

## Summary

Updated Venice text model catalog to match the complete list from the Venice API (docs.venice.ai/models/text). Replaced the previous 20-model list with the current 24-model catalog.

## Key Changes

- **Recommendations at top:** minimax-m25 (general), claude-sonnet-45 (premium), llama-3.3-70b (low-cost)
- **New models added:** MiniMax M2.5, MiniMax M2.1, Claude Opus 4.6, Claude Opus 4.5, Claude Sonnet 4.6, GPT-5.2, GLM 5, GLM 4.7 Flash, GLM 4.7 Flash Heretic, Kimi K2.5, DeepSeek V3.2
- **Removed (no longer in API):** Mistral Small 3.1, QwQ 32B, Qwen 2.5 VL, Qwen 2.5 Coder 32B, DeepSeek R1 671B, Google Gemma 3 27B, Gemini 3 Pro Preview, Qwen3 Coder 480B

## Files Modified

| File | Change |
|------|--------|
| `packages/cli/src/lib/models.ts` | Replaced venice array with 24 models from API, recommendations first |

## Self-Check: PASSED
- [x] TypeScript compiles cleanly
- [x] 24 Venice models in catalog
- [x] Top 3 are recommendations with tags
- [x] All model IDs match Venice API response
