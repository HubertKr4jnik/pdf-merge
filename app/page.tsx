"use client";
import { useState, useEffect } from "react";
import Dropzone from "react-dropzone";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import PageItem from "./pageItem";
import GroupDropZone from "./groupDropZone";

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

type tocEntry = {
  name: string;
  startPage: number;
  endPage: number;
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
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [groups, setGroups] = useState<{
    [groupId: string]: { name: string; pages: string[] };
  }>({});

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
    console.log("All files accepted");
    const urls = acceptedFiles.map((file) => URL.createObjectURL(file));
    console.log("All files converted to URLs");
    setFileUrls(urls);
    console.log("File URLs set");
    setPageItems([]);
    setPageImages({});
    console.log("Generating Images from PDFs");
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

    const scale = 1.0;
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
    page.cleanup();
    return canvas.toDataURL("image/png");
  };

  const generatePageImages = async (urls: string[], files: File[]) => {
    if (!files || !urls) {
      return;
    }

    setIsGeneratingImages(true);
    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const fileUrl = urls[fileIndex];

        const pdfjsLib = await import("pdfjs-dist");
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdfDocument = await loadingTask.promise;
        const numberOfPages = pdfDocument.numPages;

        let batchImages: Record<string, string> = {};
        let batchPages: PDFPageItem[] = [];

        for (let pageIndex = 0; pageIndex < numberOfPages; pageIndex++) {
          console.log(`Generating image from ${fileIndex} ${pageIndex}`);
          const imageUrl = await convertPdfToImage(fileUrl, pageIndex);
          const pageId = `f-${fileIndex}-p${pageIndex}`;

          batchImages[pageId] = imageUrl;
          batchPages.push({
            fileIndex: fileIndex,
            pageNumber: pageIndex,
            id: pageId,
            fileName: files[fileIndex].name,
          });

          if ((pageIndex + 1) % 10 === 0 || pageIndex === numberOfPages - 1) {
            await new Promise((resolve) => {
              setPageImages((prev) => {
                const updated = { ...prev, ...batchImages };
                resolve(null);
                return updated;
              });
            });
            await new Promise((resolve) => {
              setPageItems((prev) => {
                const updated = [...prev, ...batchPages];
                resolve(null);
                return updated;
              });
            });
            console.log("Batch finished");
            batchImages = {};
            batchPages = [];
          }
        }
        pdfDocument.destroy();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    const activeId = active.id;
    const overId = over.id;

    const activeContainer = findPageContainer(active.id);
    const overContainer = findPageContainer(over.id);

    if (activeContainer && activeContainer === overContainer) {
      if (activeContainer === "ungrouped") {
        const oldIndex = pageItems.findIndex((item) => item.id === active.id);
        const newIndex = pageItems.findIndex((item) => item.id === over.id);

        setPageItems((items) => arrayMove(items, oldIndex, newIndex));
      } else {
        setGroups((prev) => {
          const group = prev[activeContainer];
          const oldIndex = group.pages.findIndex((id) => id === activeId);
          const newIndex = group.pages.findIndex((id) => id === overId);
          const newPages = arrayMove(group.pages, oldIndex, newIndex);
          return {
            ...prev,
            [activeContainer]: { ...group, pages: newPages },
          };
        });
      }
    } else {
      setGroups((prev) => {
        const updatedGroups = { ...prev };

        if (activeContainer && activeContainer !== "ungrouped") {
          updatedGroups[activeContainer].pages = updatedGroups[
            activeContainer
          ].pages.filter((id) => id !== activeId);
        }

        if (overContainer && overContainer !== "ungrouped") {
          const insertIndex = updatedGroups[overContainer].pages.findIndex(
            (id) => id === overId
          );
          const newPages = [...updatedGroups[overContainer].pages];
          // newPages.splice(insertIndex, 0, activeId);

          updatedGroups[overContainer].pages = newPages;
        }

        return updatedGroups;
      });
    }

    // if (active.id !== over.id && over) {
    //   setPageItems((items) => {
    //     const oldIndex = items.findIndex((item) => item.id === active.id);
    //     const newIndex = items.findIndex((item) => item.id === over.id);

    //     return arrayMove(items, oldIndex, newIndex);
    //   });
    // }

    if (groups[overId]) {
      setGroups((prev) => ({
        ...prev,
        [overId]: {
          ...prev[overId],
          pages: [...prev[overId].pages, activeId],
        },
      }));
      console.log(groups);
    }
  };

  const handlePdfMerge = async () => {
    if (!files) return;

    const mergedPDF = await PDFDocument.create();

    // for (const pageItem of pageItems) {
    //   const file = files[pageItem.fileIndex];
    //   const arrayBuffer = await file.arrayBuffer();
    //   const pdf = await PDFDocument.load(arrayBuffer);
    //   const [page] = await mergedPDF.copyPages(pdf, [pageItem.pageNumber]);
    //   mergedPDF.addPage(page);
    // }

    const font = await mergedPDF.embedFont(StandardFonts.Helvetica);

    let pageCounter = 1;
    const tableOfContents: tocEntry[] = [];

    for (const [groupId, group] of Object.entries(groups)) {
      const startPage = pageCounter;
      {
        for (const pageId of group.pages) {
          const pageItem = pageItems.find((p) => p.id === pageId);
          const file = files[pageItem.fileIndex];
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await PDFDocument.load(arrayBuffer);
          const [page] = await mergedPDF.copyPages(pdf, [pageItem.pageNumber]);
          mergedPDF.addPage(page);
          pageCounter++;
        }
      }
      const endPage = pageCounter - 1;
      tableOfContents.push({
        name: group.name,
        startPage: startPage + 1,
        endPage: endPage + 1,
      });
    }

    for (const pageItem of ungroupedPages) {
      const file = files[pageItem.fileIndex];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const [page] = await mergedPDF.copyPages(pdf, [pageItem.pageNumber]);
      mergedPDF.addPage(page);
    }

    tableOfContents.push({
      name: "Ungrouped",
      startPage: pageCounter + 1,
      endPage: pageItems.length + 1,
    });

    const tocPage = mergedPDF.insertPage(0, [595.28, 841.89]);
    const fontSize = 14;
    const lineHeight = fontSize + 4;

    tocPage.drawText("Table of contents", {
      x: 50,
      y: 800,
      size: 20,
      font,
      color: rgb(0, 0, 0),
    });

    tableOfContents.forEach((entry, index) => {
      const y = 760 - index * lineHeight;
      const { name, startPage, endPage } = entry;

      const text = `${name}: ${startPage} - ${endPage}`;
      tocPage.drawText(text, {
        x: 50,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = fontSize;

      const destinationPage = mergedPDF.getPage(startPage - 1);
      tocPage.doc.context.register(destinationPage.ref);
    });

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

  const handleGroupCreate = () => {
    const groupId = `group-${Date.now()}`;
    setGroups((prev) => ({
      ...prev,
      [groupId]: {
        name: newGroupName,
        pages: [],
      },
    }));
    setNewGroupName("");
  };

  const groupedPageIds = new Set(
    Object.values(groups).flatMap((group) => group.pages)
  );

  const ungroupedPages = pageItems.filter(
    (page) => !groupedPageIds.has(page.id)
  );

  const findPageContainer = (pageId: string) => {
    for (const [groupId, group] of Object.entries(groups)) {
      if (group.pages.includes(pageId)) {
        return groupId;
      }
    }
    if (pageItems.find((page) => page.id === pageId)) {
      return "ungrouped";
    }
    return null;
  };

  if (!isClient || !pdfjsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="flex justify-center place-items-center h-18 bg-zinc-950 border-b border-gray-600">
        <div className="flex justify-center gap-4">
          <input
            type="text"
            value={mergedFileName || ""}
            onChange={(e) => setMergedFileName(e.target.value)}
            placeholder="Merged file name..."
            className="border border-cyan-600 px-2 rounded text-white"
          />
          <input
            type="button"
            value="Merge pdfs"
            onClick={handlePdfMerge}
            className="px-4 py-2 border border-cyan-600 text-gray-300 hover:text-gray-100 hover:border-cyan-400 transition-all cursor-pointer rounded"
          />
        </div>
      </header>
      <main className="h-fit my-8">
        {!files && (
          <Dropzone
            onDrop={(acceptedFiles) => {
              handleFileDrop(acceptedFiles);
            }}
            accept={{ "application/pdf": [] }}
          >
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps()}
                className="flex justify-center place-items-center border-cyan-800 border-2 hover:border-dotted transition-all h-32 w-4/5 mx-auto my-4 cursor-pointer rounded"
              >
                <input {...getInputProps()} />
                <p className="text-white hover:underline text-center p-4">
                  Drag 'n' drop some files here, or click to select them <br />
                  (select all files at once)
                </p>
              </div>
            )}
          </Dropzone>
        )}
        {/* {console.log(pageItems.length, fileUrls, pageItems > 0 && fileUrls)} */}
        {pageItems.length > 0 && fileUrls && (
          <>
            <div className="relative flex place-items-center justify-center border m-4 py-4 gap-4 border-gray-600 rounded hover:border-cyan-600 transition-all">
              <input
                type="text"
                placeholder="New group name..."
                className="border border-gray-600 p-2 rounded text-white"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <p
                className="px-4 py-2 border border-gray-600 text-gray-300 hover:text-gray-100 hover:border-cyan-600 transition-all cursor-pointer rounded"
                onClick={handleGroupCreate}
              >
                Add
              </p>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {Object.entries(groups).map(([groupId, group]) => (
                <GroupDropZone key={groupId} id={groupId}>
                  <SortableContext
                    items={group.pages}
                    strategy={rectSortingStrategy}
                  >
                    <p>
                      {group.name}{" "}
                      <span className="text-gray-400">
                        (drag and drop pages into the center of this element to
                        add them)
                      </span>
                    </p>
                    <div className="flex gap-4 w-full h-full">
                      {group.pages.map((pageId) => {
                        const item = pageItems.find((p) => p.id === pageId);
                        return (
                          item && (
                            <PageItem
                              key={item.id}
                              item={item}
                              imageUrl={pageImages[item.id]}
                              onDelete={handlePageDelete}
                            />
                          )
                        );
                      })}
                    </div>
                  </SortableContext>
                </GroupDropZone>
              ))}
              <SortableContext
                items={[...pageItems.map((item) => item.id)]}
                strategy={rectSortingStrategy}
              >
                <div className="flex flex-wrap gap-4 justify-center">
                  {ungroupedPages.map((item) => {
                    console.log("Rendering page");
                    return (
                      <PageItem
                        key={item.id}
                        item={item}
                        imageUrl={pageImages[item.id]}
                        onDelete={handlePageDelete}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </main>
    </div>
  );
}
