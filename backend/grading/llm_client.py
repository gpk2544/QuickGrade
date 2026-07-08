from __future__ import annotations
import os
import time
from typing import Optional
from config.settings import GRADING
from utils.logger import get_logger
log = get_logger(__name__)
_client = None
def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        if not api_key:
            raise EnvironmentError(
                "GROQ_API_KEY is not set. "
                "Get a free key at https://console.groq.com"
            )
        from groq import Groq
        _client = Groq(api_key=api_key)
    return _client
def call(
    user_prompt: str,
    system_prompt: str,
    preferred_model: Optional[str] = None,
) -> str:
    client = _get_client()
    models = list(GRADING.models)
    if preferred_model and preferred_model not in models:
        models.insert(0, preferred_model)
    last_error = ""
    for model in models:
        for attempt in range(1, GRADING.max_api_retries + 1):
            try:
                t_start  = time.time()
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": user_prompt},
                    ],
                    max_tokens=GRADING.max_tokens,
                    temperature=GRADING.temperature,
                )
                latency = time.time() - t_start
                usage   = response.usage
                raw     = response.choices[0].message.content.strip()
                log.info(
                    "LLM call: model=%s attempt=%d latency=%.2fs "
                    "prompt_tokens=%d completion_tokens=%d",
                    model, attempt, latency,
                    usage.prompt_tokens, usage.completion_tokens,
                )
                return raw
            except Exception as exc:
                last_error = str(exc)
                if "429" in last_error or "rate_limit" in last_error.lower():
                    wait = GRADING.rate_limit_sleep * attempt
                    log.warning(
                        "Rate-limited on %s (attempt %d). Waiting %ds…",
                        model, attempt, wait,
                    )
                    time.sleep(wait)
                else:
                    log.error("Model %s attempt %d failed: %s", model, attempt, last_error)
                    break   
    raise RuntimeError(f"All Groq models failed. Last error: {last_error}")