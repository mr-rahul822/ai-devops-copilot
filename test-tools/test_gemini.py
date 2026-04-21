import httpx
import asyncio
import json

async def run():
    client = httpx.AsyncClient()
    headers = {"Authorization": "Bearer AIzaSyAlW8BphFqm84MEBTxpHuXmKquHtzjA0YI"}
    data = {
        "model": "gemini-2.0-flash",
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 100
    }
    resp = await client.post('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', headers=headers, json=data)
    print(resp.status_code, resp.text)

asyncio.run(run())
