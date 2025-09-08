"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Document = dynamic(
  () => import("react-pdf").then((mod) => ({ default: mod.Document })),
  { ssr: false }
);

const Page = dynamic(
  () => import("react-pdf").then((mod) => ({ default: mod.Page })),
  { ssr: false }
);

type PDFPageItem = {
  fileIndex: number;
  pageNumber: number;
  id: string;
};

export default function PageItem({
  item,
  file,
}: {
  item: PDFPageItem;
  file: File;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Document
        file={file}
        onLoadError={(err) => console.error("PageItem load error:", err)}
      >
        <Page pageNumber={item.pageNumber + 1} width={300} />
      </Document>
      <p>
        File {item.fileIndex + 1}, Page {item.pageNumber + 1}
      </p>
    </div>
  );
}
