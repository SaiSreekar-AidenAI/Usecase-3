import asyncio
import logging

logger = logging.getLogger(__name__)

_queue: asyncio.Queue | None = None
_task: asyncio.Task | None = None
_running = False

BATCH_SIZE = 50
FLUSH_INTERVAL_S = 2.0


def _get_queue() -> asyncio.Queue:
    global _queue
    if _queue is None:
        _queue = asyncio.Queue()
    return _queue


async def emit_event(event: dict) -> None:
    """Put an audit event on the queue (non-blocking)."""
    try:
        _get_queue().put_nowait(event)
    except asyncio.QueueFull:
        logger.warning("Audit event queue full, dropping event")


async def _process_batch(events: list[dict]) -> None:
    """Write a batch of events to the database."""
    from ..database import save_audit_events_batch
    if not events:
        return
    try:
        await save_audit_events_batch(events)
    except Exception:
        logger.exception(f"Failed to write {len(events)} audit events")


async def _processor_loop() -> None:
    """Background loop that drains the queue and writes batches to DB."""
    global _running
    q = _get_queue()
    _running = True
    logger.info("Audit event processor started")

    while _running:
        batch: list[dict] = []
        try:
            # Wait for first event (with timeout)
            event = await asyncio.wait_for(q.get(), timeout=FLUSH_INTERVAL_S)
            batch.append(event)
        except asyncio.TimeoutError:
            continue
        except asyncio.CancelledError:
            break

        # Drain up to BATCH_SIZE more without waiting
        while len(batch) < BATCH_SIZE:
            try:
                batch.append(q.get_nowait())
            except asyncio.QueueEmpty:
                break

        await _process_batch(batch)

    # Drain remaining events on shutdown
    remaining: list[dict] = []
    while not q.empty():
        try:
            remaining.append(q.get_nowait())
        except asyncio.QueueEmpty:
            break
    if remaining:
        await _process_batch(remaining)
    logger.info("Audit event processor stopped")


async def start_event_processor() -> None:
    global _task
    _task = asyncio.create_task(_processor_loop())


async def stop_event_processor() -> None:
    global _running, _task
    _running = False
    if _task:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
