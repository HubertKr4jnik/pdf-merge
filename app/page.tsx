"use client";
import { useState, useEffect } from "react";
import Dropzone from "react-dropzone";
import { PDFDocument, PDFName, rgb, StandardFonts } from "pdf-lib";
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
  TouchSensor,
} from "@dnd-kit/core";
import { PDFDocumentProxy } from "pdfjs-dist";

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
  const [rebuildGroups, setRebuildGroups] = useState<boolean>(true);

  const groupIds = Object.keys(groups);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
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

  useEffect(() => {
    if (rebuildGroups && pageItems.length > 0 && files) {
      rebuildGroupsFromPdf(files, pageItems).then(setGroups);
      setRebuildGroups(false);
    }
  }, [pageItems, files]);

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

    if (!context) {
      throw new Error("Could not get context from page");
    }

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

    const activeIsGroup = groups.hasOwnProperty(active.id);
    const overIsGroup = groups.hasOwnProperty(over.id);

    if (activeIsGroup && overIsGroup) {
      const oldIndex = groupIds.indexOf(active.id);
      const newIndex = groupIds.indexOf(over.id);

      if (oldIndex !== newIndex) {
        const newGroupOrder = arrayMove(groupIds, oldIndex, newIndex);

        const reorderedGroups: typeof groups = {};
        newGroupOrder.forEach((id) => {
          reorderedGroups[id] = groups[id];
        });
        setGroups(reorderedGroups);
      }
    } else {
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
            updatedGroups[overContainer].pages = newPages;
          }

          return updatedGroups;
        });
      }

      if (groups[overId]) {
        setGroups((prev) => ({
          ...prev,
          [overId]: {
            ...prev[overId],
            pages: [...prev[overId].pages, activeId],
          },
        }));
        // console.log(groups);
      }
    }
  };

  const handlePdfMerge = async () => {
    if (!files) return;

    const mergedPDF = await PDFDocument.create();

    const font = await mergedPDF.embedFont(StandardFonts.Helvetica);

    let pageCounter = 1;
    const tableOfContents: tocEntry[] = [];

    for (const [groupId, group] of Object.entries(groups)) {
      const startPage = pageCounter;
      {
        for (const pageId of group.pages) {
          const pageItem = pageItems.find((p) => p.id === pageId);

          if (!pageItem) {
            return;
          }

          const file = files[pageItem.fileIndex];
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await PDFDocument.load(arrayBuffer);
          const [page] = await mergedPDF.copyPages(pdf, [pageItem.pageNumber]);

          const fontSize = 10;
          const text = `Group: ${group.name}`;
          const textWidth = font.widthOfTextAtSize(text, fontSize);

          const x = 40;
          const y = 20;

          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0.5, 0.5, 0.5),
          });

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

    if (ungroupedPages.length > 0) {
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
    }

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
      const destinationRef = destinationPage.ref;

      const destinationArray = mergedPDF.context.obj([
        destinationRef,
        PDFName.of("Fit"),
      ]);

      const linkAnnotation = mergedPDF.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [50, y, 50 + textWidth, y + textHeight],
        Border: [0, 0, 0],
        A: {
          Type: "Action",
          S: "GoTo",
          D: destinationArray,
        },
      });

      const annots = tocPage.node.Annots() || mergedPDF.context.obj([]);
      const annotsArray = mergedPDF.context.obj([]);

      for (let i = 0; i < annots.size(); i++) {
        annotsArray.push(annots.get(i));
      }

      annotsArray.push(linkAnnotation);

      tocPage.node.set(PDFName.of("Annots"), annotsArray);

      tocPage.doc.context.register(destinationPage.ref);
    });

    const savedPDF = await mergedPDF.save();

    const mergedFileBlob = new Blob([new Uint8Array(savedPDF)], {
      type: "application/pdf",
    });
    const mergedFileURL = URL.createObjectURL(mergedFileBlob);

    // console.log(mergedFileURL);

    const a = document.createElement("a");
    a.href = mergedFileURL;
    a.download = mergedFileName || "merged";
    a.click();
  };

  const getGroupNameFromPage = async (
    pdf: PDFDocumentProxy,
    pageIndex: number
  ) => {
    const page = await pdf.getPage(pageIndex + 1);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if ("str" in item && item.str.startsWith("Group:")) {
        return item.str.replace("Group: ", "").trim();
      }
    }
    return null;
  };

  const rebuildGroupsFromPdf = async (
    files: File[],
    pageItems: PDFPageItem[]
  ) => {
    const rebuiltGroups: {
      [groupId: string]: {
        name: string;
        pages: string[];
      };
    } = {};

    const pdfjsLib = await import("pdfjs-dist");

    const pdfCache: { [key: number]: PDFDocumentProxy } = {};

    for (const pageItem of pageItems) {
      const fileIndex = pageItem.fileIndex;

      if (!pdfCache[fileIndex]) {
        const arrayBuffer = await files[fileIndex].arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfCache[fileIndex] = await loadingTask.promise;
      }

      const pdf = pdfCache[fileIndex];

      const groupName = await getGroupNameFromPage(pdf, pageItem.pageNumber);

      if (groupName) {
        const groupId = groupName.toLowerCase().replace(/\s+/g, "-");

        if (!rebuiltGroups[groupId]) {
          rebuiltGroups[groupId] = {
            name: groupName,
            pages: [],
          };
        }

        rebuiltGroups[groupId].pages.push(pageItem.id);
      }
    }

    return rebuiltGroups;
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
        name: newGroupName || `Group ${Object.entries(groups).length + 1}`,
        pages: [],
      },
    }));
    setNewGroupName("");
  };

  const handleGroupDelete = (groupId: string) => {
    setGroups((prev) => {
      const updated = { ...prev };
      delete updated[groupId];
      return updated;
    });
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
            <p className="text-center">Drag and drop groups to reorder them</p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={groupIds} strategy={rectSortingStrategy}>
                {Object.entries(groups).map(([groupId, group]) => (
                  <GroupDropZone key={groupId} id={groupId}>
                    <SortableContext
                      items={group.pages}
                      strategy={rectSortingStrategy}
                    >
                      <div className="flex place-items-center justify-between">
                        <p>
                          {group.name}{" "}
                          <span className="text-gray-400">
                            (drag and drop pages into the center of this element
                            to add them)
                          </span>
                        </p>
                        <input
                          type="button"
                          value="Delete"
                          className="text-gray-400 pr-2 hover:text-white hover:underline cursor-pointer transition-all"
                          onClick={() => handleGroupDelete(groupId)}
                        />
                      </div>
                      <div className="flex flex-wrap pt-4 gap-4 w-full h-full">
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
              </SortableContext>
              <GroupDropZone id="ungrouped">
                <SortableContext
                  items={[...pageItems.map((item) => item.id)]}
                  strategy={rectSortingStrategy}
                >
                  <div className="flex flex-col gap-4">
                    <p>Ungrouped</p>
                    <div className="flex flex-wrap gap-4">
                      {ungroupedPages.map((item) => {
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
                  </div>
                </SortableContext>
              </GroupDropZone>
            </DndContext>
          </>
        )}
      </main>
    </div>
  );
}
