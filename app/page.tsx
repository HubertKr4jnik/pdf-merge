"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import Dropzone from "react-dropzone";
import { PDFDocument } from "pdf-lib";
import dynamic from "next/dynamic";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

const Document = dynamic(
  () => import("react-pdf").then((mod) => ({ default: mod.Document })),
  { ssr: false }
);

const Page = dynamic(
  () => import("react-pdf").then((mod) => ({ default: mod.Page })),
  { ssr: false }
);

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
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);

  useEffect(() => {
    setIsClient(true);
    loadPdfjs().then(() => {
      setPdfjsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    const updateWidth = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        const containerWidth = fileContainerRef.current?.offsetWidth;
        console.log("Container width:", containerWidth);

        if (containerWidth && containerWidth > 0) {
          const newWidth = containerWidth - 40;
          console.log("Setting display width to:", newWidth);
          setDisplayFileWidth(newWidth);
        }
      }, 200);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);

    return () => {
      window.removeEventListener("resize", updateWidth);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isClient]);

  const handleFileDrop = (acceptedFiles: Array<File>) => {
    setFiles(acceptedFiles);
    setFilePagesMap({});
    setPageItems([]);
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
      console.log(`File ${index} loaded with ${numPages} pages`);
      return updated;
    });
  };

  const handlePdfMerge = async () => {
    if (!files) return;

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

  if (!isClient || !pdfjsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <h1 className="text-3xl font-bold text-center mt-6">
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
            <p className="hover:underline text-center p-4">
              Drag 'n' drop some files here, or click to select files
            </p>
          </div>
        )}
      </Dropzone>

      <div ref={fileContainerRef}>
        {files && (
          <div>
            {files.map((file, fileIndex) => (
              <div key={`file-${fileIndex}-${file.name}`}>
                <Document
                  file={file}
                  onLoadSuccess={(data) => handleLoadSuccess(data, fileIndex)}
                  onLoadError={(err) => console.error(err)}
                  className="flex flex-wrap justify-center gap-4"
                >
                  {filePagesMap[fileIndex] &&
                    Array.from(
                      { length: filePagesMap[fileIndex] },
                      (_, pageIndex) => (
                        <div
                          key={`file-${fileIndex}-page-${pageIndex}`}
                          className="w-fit"
                        >
                          <p>
                            {file.name}, Page {pageIndex + 1}
                          </p>
                          <Page pageNumber={pageIndex + 1} width={300} />
                        </div>
                      )
                    )}
                </Document>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
