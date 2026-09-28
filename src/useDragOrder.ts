import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * Reordering rows by dragging a handle. Rows are measured when a drag starts; the dragged row follows the
 * finger and the rows it passes slide aside, and letting go calls `move(id, newIndex)`. Arrow keys on a
 * focused handle move it one place.
 */
export function useDragOrder(ids: string[], move: (id: string, to: number) => void) {
  const rows = useRef(new Map<string, HTMLElement>());
  const [drag, setDrag] = useState<{ id: string; from: number; to: number; startY: number; dy: number; mids: number[]; height: number } | null>(null);

  const rowProps = (id: string, i: number) => ({
    ref: (el: HTMLElement | null) => {
      if (el) rows.current.set(id, el);
      else rows.current.delete(id);
    },
    className: drag?.id === id ? 'dragging' : drag ? 'shifting' : '',
    style: ((): CSSProperties | undefined => {
      if (!drag) return undefined;
      if (i === drag.from) return { transform: `translateY(${drag.dy}px)` };
      if (drag.from < i && i <= drag.to) return { transform: `translateY(${-drag.height}px)` };
      if (drag.to <= i && i < drag.from) return { transform: `translateY(${drag.height}px)` };
      return { transform: 'none' };
    })(),
  });

  const handleProps = (id: string, i: number, label: string) => ({
    className: 'drag-handle',
    'aria-label': `Move ${label} (arrow keys)`,
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const boxes = ids.map(x => rows.current.get(x)!.getBoundingClientRect());
      setDrag({ id, from: i, to: i, startY: e.clientY, dy: 0, mids: boxes.map(b => b.top + b.height / 2), height: boxes[i].height });
    },
    onPointerMove: (e: PointerEvent) => {
      if (!drag) return;
      const dy = e.clientY - drag.startY;
      const center = drag.mids[drag.from] + dy;
      setDrag({ ...drag, dy, to: drag.mids.filter((m, k) => k !== drag.from && m < center).length });
    },
    onPointerUp: () => {
      if (drag && drag.to !== drag.from) move(drag.id, drag.to);
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && i > 0) move(id, i - 1);
      if (e.key === 'ArrowDown' && i < ids.length - 1) move(id, i + 1);
    },
  });

  return { rowProps, handleProps };
}
