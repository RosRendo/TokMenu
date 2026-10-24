"""In-process WebSocket fan-out. Single backend instance; swap for Redis pub/sub when scaling horizontally."""
import asyncio
from collections import defaultdict


class Hub:
    def __init__(self):
        self.rooms = defaultdict(set)

    def join(self, room: str, ws):
        self.rooms[room].add(ws)

    def leave(self, room: str, ws):
        self.rooms[room].discard(ws)
        if not self.rooms[room]:
            self.rooms.pop(room, None)

    async def publish(self, room: str, message: dict):
        for ws in list(self.rooms.get(room, ())):
            try:
                await asyncio.wait_for(ws.send_json(message), timeout=5)
            except Exception:
                self.leave(room, ws)


hub = Hub()
