"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect } from "react";

type PDFPageItem = {
  fileIndex: number;
  pageNumber: number;
  id: string;
  fileName?: string;
};

interface PageItemProps {
  item: PDFPageItem;
  imageUrl?: string;
  width: number;
}

export default function PageItem({ item, imageUrl, width }: PageItemProps) {
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

  console.log(`PageItem ${item.id}:`, {
    imageUrl: imageUrl ? "HAS_IMAGE" : "NO_IMAGE",
  });

  if (!imageUrl) {
    return <div>Loading...</div>;
  }

  return (
    <img
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      src={imageUrl}
      width={width}
    />
  );
}
