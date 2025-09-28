import { useDroppable } from "@dnd-kit/core";

export default function GroupDropZone({ id, children }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="min-w-2/6 max-w-full min-h-52 p-4 m-4 border border-gray-600 rounded"
    >
      {children}
    </div>
  );
}
