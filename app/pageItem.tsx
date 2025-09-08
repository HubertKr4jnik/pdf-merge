import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import { pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.mjs`;

import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { Document, Page } from "react-pdf";

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
  const [renderableFile, setRenderableFile] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [canRenderPage, setCanRenderPage] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (numPages) {
      const timeout = setTimeout(() => {
        setCanRenderPage(true);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [numPages]);

  useEffect(() => {
    let url: string | null = null;
    const prepareBuffer = async () => {
      const buffer = await file.arrayBuffer();
      const blob = new Blob([buffer], { type: file.type });
      url = URL.createObjectURL(blob);
      setRenderableFile(url);
    };

    prepareBuffer();

    // return () => {
    //   if (url) {
    //     URL.revokeObjectURL(url);
    //   }
    // };
  }, [file]);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!renderableFile) {
    return null;
  }

  if (!renderableFile || !isClient) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="w-fit"
    >
      <p>
        {file.name}, Page {item.pageNumber}
      </p>
      <Document
        file={renderableFile}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={(err) => console.error(err)}
      >
        {canRenderPage && (
          <Page
            pageNumber={item.pageNumber + 1}
            width={300}
            onRenderError={(err) => console.error(err)}
          />
        )}
      </Document>
    </div>
  );
}
