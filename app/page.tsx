"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import Dropzone from "react-dropzone";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFDocument } from "pdf-lib";

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
import PageItem from "./pageItem";

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.mjs`;

type PDFPageItem = {
  fileIndex: number;
  pageNumber: number;
  id: string;
};

export default function Home() {
  const [files, setFiles] = useState<Array<File> | null>(null);
  const [filePagesMap, setFilePagesMap] = useState<Record<number, number>>({});
  const [isClient, setIsClient] = useState<boolean>(false);
  const [displayFileWidth, setDisplayFileWidth] = useState<number>(300);
  const fileContainerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mergedFileName, setMergedFileName] = useState<string | null>(null);
  const [pageItems, setPageItems] = useState<PDFPageItem[]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    const updateWidth = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      const containerWidth = fileContainerRef.current?.offsetWidth;
      if (containerWidth && containerWidth > 0) {
        resizeTimeoutRef.current = setTimeout(() => {
          setDisplayFileWidth(containerWidth - 40);
        }, 150);
      }
    };

    updateWidth();

    window.addEventListener("resize", updateWidth);

    return () => {
      window.removeEventListener("resize", updateWidth);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isClient, files]);

  const handleFileDrop = (acceptedFiles: Array<File>) => {
    setFiles(acceptedFiles);
    console.log(acceptedFiles);
    acceptedFiles.forEach((file) => {
      console.log(file.name);
    });
  };

  const handleLoadSuccess = (
    { numPages }: { numPages: number },
    index: number
  ) => {
    setFilePagesMap((prev) => {
      const updated = { ...prev, [index]: numPages };

      if (files && Object.keys(updated).length == files.length) {
        const newPageItems: PDFPageItem[] = [];
        files.forEach((file, index) => {
          const pages = updated[index];
          for (let i = 0; i < pages; i++) {
            newPageItems.push({
              fileIndex: index,
              pageNumber: i,
              id: `f${index}-p${i}`,
            });
          }
        });
        setPageItems(newPageItems);
      }
      return updated;
    });
    console.log(numPages, index);
  };

  const handlePdfMerge = async () => {
    const mergedPDF = await PDFDocument.create();

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = await mergedPDF.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((page) => mergedPDF.addPage(page));
    }

    const savedPDF = await mergedPDF.save();

    const mergedFileBlob = new Blob([savedPDF], { type: "application/pdf" });
    const mergedFileURL = URL.createObjectURL(mergedFileBlob);

    console.log(mergedFileURL);

    const a = document.createElement("a");
    a.href = mergedFileURL;
    a.download = mergedFileName || "merged";
    a.click();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (e) => {
    const { active, over } = e;
    if (!active || over.id === active.id) {
      return;
    }

    const oldIndex = pageItems.findIndex((i) => i.id === active.id);
    const newIndex = pageItems.findIndex((i) => i.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      setPageItems((items) => arrayMove(items, oldIndex, newIndex));
    }
  };
  return (
    <div className="min-h-screen">
      <h1 className="text-3xl font-bold text-center mt-6">
        Welome, upload a pdf file
      </h1>
      <div className="flex justify-center mx-auto pt-3 gap-4">
        <input
          type="text"
          value={mergedFileName || ""}
          onInput={(e) => setMergedFileName(e.target.value)}
          placeholder="Enter merged file name..."
          className="border border-white p-1 text-white"
        />
        <input
          type="button"
          value="Merge pdfs"
          onClick={handlePdfMerge}
          className="px-4 py-2 bg-white text-black hover:scale-110 transition-all cursor-pointer"
        />
      </div>
      <Dropzone
        onDrop={(acceptedFiles) => {
          handleFileDrop(acceptedFiles);
        }}
        accept={{ "application/pdf": [] }}
      >
        {({ getRootProps, getInputProps }) => (
          <div
            {...getRootProps()}
            className="flex justify-center place-items-center border-red-600 border-2 border-dashed h-22 w-4/5 mx-auto my-4 cursor-pointer"
          >
            <input {...getInputProps()} />
            <p className="hover:underline">
              Drag 'n' drop some files here, or click to select files
            </p>
          </div>
        )}
      </Dropzone>
      {/* {files && isClient && (
        <div className="flex flex-col">
          {files.map((file, index) => {
            return (
              <div
                key={index}
                className="border-2 border-blue-600 border-dotted"
              >
                <p className="px-4 pt-2 wrap-anywhere">{file.name}</p>
                <Document
                  file={file}
                  key={`file-${index}`}
                  onLoadError={(err) => console.error(err)}
                  onLoadSuccess={(data) => handleLoadSuccess(data, index)}
                  className="flex flex-wrap gap-2"
                >
                  {filePagesMap[index] &&
                    Array.from({ length: filePagesMap[index] }, (_, i) => (
                      <div
                        key={`page-${index}-${i}-container`}
                        ref={fileContainerRef}
                      >
                        <div className="flex justify-center w-42 px-4 bg-gray-800">
                          <Page
                            pageNumber={i + 1}
                            key={`page-${index}-${i}`}
                            className=" my-2"
                            width={displayFileWidth}
                          />
                        </div>
                      </div>
                    ))}
                </Document>
              </div>
            );
          })}
        </div>
      )} */}
      {files && isClient && (
        <div>
          {files.map((file, index) => (
            <Document
              key={`loader-${index}`}
              file={file}
              onLoadSuccess={(data) => handleLoadSuccess(data, index)}
              onLoadError={(err) => console.error(err)}
            ></Document>
          ))}
        </div>
      )}
      {pageItems.length > 0 && isClient && (
        // <DndContext
        //   sensors={sensors}
        //   collisionDetection={closestCenter}
        //   onDragEnd={handleDragEnd}
        // >
        //   <SortableContext
        //     items={pageItems.map((item) => item.id)}
        //     strategy={verticalListSortingStrategy}
        //   >
        <div className="flex flex-row flex-wrap justify-center gap-4">
          {pageItems.map((item) => (
            <PageItem key={item.id} item={item} file={files[item.fileIndex]} />
          ))}
        </div>
        //       </SortableContext>
        //     </DndContext>
      )}
    </div>
  );
}
