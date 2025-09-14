"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";

type PDFPageItem = {
  fileIndex: number;
  pageNumber: number;
  id: string;
  fileName?: string;
};

interface PageItemProps {
  item: PDFPageItem;
  imageUrl?: string;
  onDelete: (pageId: string) => void;
}

export default function PageItem({ item, imageUrl, onDelete }: PageItemProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: false,
  });

  if (!imageUrl) {
    return <div>Loading...</div>;
  }

  return (
    <div
      className="relative max-w-1/6"
      ref={(node) => {
        setNodeRef(node);
        ref(node);
      }}
      style={style}
      {...attributes}
      {...listeners}
    >
      <span
        onClick={(e) => {
          onDelete(item.id);
        }}
        className={
          inView
            ? "absolute top-3 right-4 font-bold text-lg text-black cursor-pointer z-1"
            : "absolute top-3 right-4 font-bold text-lg text-black cursor-pointer z-1 opacity-0"
        }
      >
        X
      </span>
      <img
        src={imageUrl}
        className={
          inView
            ? "brightness-85 hover:brightness-100 rounded transition-all"
            : "brightness-85 hover:brightness-100 rounded transition-all opacity-0"
        }
      />
    </div>
  );
}
