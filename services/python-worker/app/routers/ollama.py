import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.config import get_settings

# Proxy OpenAI-compatible → Ollama LOCAL (GPU). L'app Next.js utilise le worker
# comme 4ᵉ provider LLM (@ai-sdk/openai avec baseURL = ce worker), sans clé API.
# Volontairement NON authentifié : usage local (localhost/GPU). Pour un accès
# distant, placer le worker derrière un réseau privé ou ajouter une garde.
router = APIRouter(prefix="/v1", tags=["ollama"])

_OLLAMA_DOWN = '{"error":"Ollama injoignable. Lancez `ollama serve` et verifiez WORKER_OLLAMA_BASE_URL."}'


async def _aclose(upstream: httpx.Response, client: httpx.AsyncClient) -> None:
    await upstream.aclose()
    await client.aclose()


@router.post("/chat/completions")
async def chat_completions(request: Request) -> Response:
    """Relaie tel quel vers `{OLLAMA_BASE_URL}/v1/chat/completions` en streaming
    (SSE passthrough) — compatible avec l'API Chat Completions d'OpenAI que
    l'AI SDK envoie via `openai.chat(modelId)`."""
    base = get_settings().ollama_base_url.rstrip("/")
    body = await request.body()
    client = httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10.0))
    try:
        upstream = await client.send(
            client.build_request(
                "POST",
                f"{base}/v1/chat/completions",
                content=body,
                headers={"content-type": "application/json"},
            ),
            stream=True,
        )
    except httpx.ConnectError:
        await client.aclose()
        return Response(content=_OLLAMA_DOWN, status_code=502, media_type="application/json")

    return StreamingResponse(
        upstream.aiter_raw(),
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type", "text/event-stream"),
        background=BackgroundTask(_aclose, upstream, client),
    )


@router.get("/models")
async def models() -> Response:
    """Liste des modèles locaux (proxy de `{OLLAMA_BASE_URL}/v1/models`)."""
    base = get_settings().ollama_base_url.rstrip("/")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(f"{base}/v1/models")
        except httpx.ConnectError:
            return Response(content=_OLLAMA_DOWN, status_code=502, media_type="application/json")
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type="application/json",
    )
