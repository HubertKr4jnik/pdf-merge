"use client";
import { useState, useEffect } from "react";
import Dropzone from "react-dropzone";
import { PDFDocument } from "pdf-lib";
import PageItem from "./pageItem";

import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

const loadPdfjs = async () => {
  if (typeof window !== "undefined") {
    const { pdfjs } = await import("react-pdf");
    pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.mjs`;
    return pdfjs;
  }
};

type PDFPageItem = {
  fileIndex: number;
  pageNumber: number;
  id: string;
  fileName: string;
};

export default function Home() {
  const [files, setFiles] = useState<Array<File> | null>(null);
  const [fileUrls, setFileUrls] = useState<Array<string> | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [mergedFileName, setMergedFileName] = useState<string | null>(null);
  const [pageItems, setPageItems] = useState<PDFPageItem[]>([]);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [pageImages, setPageImages] = useState<Record<string, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  useEffect(() => {
    setIsClient(true);
    loadPdfjs().then(() => {
      setPdfjsLoaded(true);
    });
  }, []);

  const handleFileDrop = async (acceptedFiles: Array<File>) => {
    setFiles(acceptedFiles);
    const urls = acceptedFiles.map((file) => URL.createObjectURL(file));
    setFileUrls(urls);
    setPageItems([]);
    setPageImages({});
    await generatePageImages(urls, acceptedFiles);
  };

  const convertPdfToImage = async (
    fileUrl: string,
    pageNumber: number
  ): Promise<string> => {
    const pdfjsLib = await import("pdfjs-dist");

    const loadingTask = pdfjsLib.getDocument(fileUrl);
    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(pageNumber + 1);

    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    return canvas.toDataURL("image/png");
  };

  const generatePageImages = async (urls: string[], files: File[]) => {
    if (!files || !urls) {
      return;
    }

    setIsGeneratingImages(true);
    const imageMap: Record<string, string> = {};
    const newPageItems: PDFPageItem[] = [];

    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const fileUrl = urls[fileIndex];

        const pdfjsLib = await import("pdfjs-dist");
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdfDocument = await loadingTask.promise;
        const numberOfPages = pdfDocument.numPages;

        for (let pageIndex = 0; pageIndex < numberOfPages; pageIndex++) {
          const imageUrl = await convertPdfToImage(fileUrl, pageIndex);
          const pageId = `f-${fileIndex}-p${pageIndex}`;

          imageMap[pageId] = imageUrl;
          newPageItems.push({
            fileIndex: fileIndex,
            pageNumber: pageIndex,
            id: pageId,
            fileName: files[fileIndex].name,
          });
        }
      }

      setPageImages(imageMap);
      setPageItems(newPageItems);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id && over) {
      setPageItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handlePdfMerge = async () => {
    if (!files) return;

    const mergedPDF = await PDFDocument.create();

    for (const pageItem of pageItems) {
      const file = files[pageItem.fileIndex];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const [page] = await mergedPDF.copyPages(pdf, [pageItem.pageNumber]);
      mergedPDF.addPage(page);
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

  const handlePageDelete = (pageId: string) => {
    setPageItems((prev) => prev.filter((page) => page.id !== pageId));

    setPageImages((prev) => {
      const newImages = { ...prev };

      if (newImages[pageId] && newImages[pageId].startsWith("blob")) {
        URL.revokeObjectURL(newImages[pageId]);
      }

      delete newImages[pageId];
      return newImages;
    });
  };

  if (!isClient || !pdfjsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <h1 className="text-3xl text-white font-bold text-center pt-6">
        Welcome, upload a pdf file
      </h1>
      <div className="flex justify-center mx-auto pt-3 gap-4">
        <input
          type="text"
          value={mergedFileName || ""}
          onChange={(e) => setMergedFileName(e.target.value)}
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
            className="flex justify-center place-items-center border-red-600 border-2 border-dashed h-32 w-4/5 mx-auto my-4 cursor-pointer"
          >
            <input {...getInputProps()} />
            <p className="text-white hover:underline text-center p-4">
              Drag 'n' drop some files here, or click to select files
            </p>
          </div>
        )}
      </Dropzone>

      {pageItems.length > 0 && fileUrls && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pageItems.map((item) => item.id)}
            strategy={rectSortingStrategy}
          >
            <div className="flex flex-wrap gap-4 justify-center">
              {pageItems.map((item) => (
                <PageItem
                  key={item.id}
                  item={item}
                  imageUrl={pageImages[item.id]}
                  onDelete={handlePageDelete}
                ></PageItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
