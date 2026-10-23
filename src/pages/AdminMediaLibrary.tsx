
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderInput,
  Image as ImageIcon,
  RefreshCw,
  Search,
  X,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { AdminLayout } from "../components/AdminLayout";
import { supabase } from "../lib/supabase";

interface MediaAsset {
  id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  public_url: string;
  file_size: number;
  mime_type: string;
  folder_id: string | null;
  created_at: string;
}

interface MediaFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

type FolderSelection = "all" | "uncategorized" | string;
type UsageFilter = "all" | "used" | "unused";

const PAGE_SIZE = 24;
const MEDIA_BUCKETS = ["products", "category-images"] as const;

export default function AdminMediaLibrary() {
  const [images, setImages] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [usedUrls, setUsedUrls] = useState<Set<string>>(new Set());

  const [selectedFolder, setSelectedFolder] =
    useState<FolderSelection>("all");

  const [filter, setFilter] = useState<UsageFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [renamingFolder, setRenamingFolder] = useState<MediaFolder | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<MediaFolder | null>(null);
  const [processingDelete, setProcessingDelete] = useState(false);

  const [movingImage, setMovingImage] = useState<MediaAsset | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>("");
  const [processingMove, setProcessingMove] = useState(false);
  const [deletingImage, setDeletingImage] = useState<MediaAsset | null>(null);
  const [processingImageDelete, setProcessingImageDelete] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchLibrary = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const [mediaResult, folderResult, categoryResult, productResult] =
  await Promise.all([
    supabase.from("media_assets").select("*"),
    supabase.from("media_folders").select("*").order("name"),
    supabase.from("categories").select("image_url"),
    supabase.from("products").select("images"),
  ]);

    if (mediaResult.error) throw mediaResult.error;
    if (folderResult.error) throw folderResult.error;
    if (categoryResult.error) throw categoryResult.error;
    if (productResult.error) throw productResult.error;

    const registeredAssets: MediaAsset[] = mediaResult.data ?? [];

    const registeredMap = new Map(
      registeredAssets.map((asset) => [
        `${asset.storage_bucket}/${asset.storage_path}`,
        asset,
      ])
    );

    const allImages: MediaAsset[] = [];

    // Recursively load files from a bucket, including nested folders.
    const loadBucketFolder = async (
      bucket: string,
      folderPath = ""
    ): Promise<void> => {
      const pageSize = 100;
      let offset = 0;

      while (true) {
        const { data, error: listError } = await supabase.storage
          .from(bucket)
          .list(folderPath, {
            limit: pageSize,
            offset,
            sortBy: { column: "name", order: "asc" },
          });

        if (listError) throw listError;

        const entries = data ?? [];

        for (const entry of entries) {
          const path = folderPath
            ? `${folderPath}/${entry.name}`
            : entry.name;

          // Supabase folders have no file ID.
          if (!entry.id) {
            await loadBucketFolder(bucket, path);
            continue;
          }

          const isImage =
            entry.metadata?.mimetype?.startsWith("image/") ||
            /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(entry.name);

          if (!isImage) continue;

          const key = `${bucket}/${path}`;
          const registered = registeredMap.get(key);

          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);

          allImages.push({
            id: registered?.id ?? key,
            file_name: registered?.file_name ?? entry.name,
            storage_bucket: bucket,
            storage_path: path,
            public_url: urlData.publicUrl,
            file_size: registered?.file_size ?? entry.metadata?.size ?? 0,
            mime_type:
              registered?.mime_type ??
              entry.metadata?.mimetype ??
              "image/*",
            folder_id: registered?.folder_id ?? null,
            created_at:
              registered?.created_at ??
              entry.created_at ??
              new Date(0).toISOString(),
          });
        }

        if (entries.length < pageSize) break;

        offset += pageSize;
      }
    };

    for (const bucket of MEDIA_BUCKETS) {
      await loadBucketFolder(bucket);
    }

    allImages.sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

    setImages(allImages);
    setFolders(folderResult.data ?? []);

    const usedImageUrls = new Set<string>();

// Category images
(categoryResult.data ?? []).forEach((category) => {
  if (typeof category.image_url === "string" && category.image_url) {
    usedImageUrls.add(category.image_url);
  }
});

// Product images stored as JSONB arrays
(productResult.data ?? []).forEach((product) => {
  if (Array.isArray(product.images)) {
    product.images.forEach((url: unknown) => {
      if (typeof url === "string" && url) {
        usedImageUrls.add(url);
      }
    });
  }
});

setUsedUrls(usedImageUrls);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to load media library"
    );
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    void fetchLibrary();
  }, [fetchLibrary]);

  const currentFolder =
    folders.find((folder) => folder.id === selectedFolder) ?? null;

  const breadcrumbs = useMemo(() => {
    const result: MediaFolder[] = [];
    const visited = new Set<string>();

    let current = currentFolder;

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      result.unshift(current);

      current =
        folders.find((folder) => folder.id === current?.parent_id) ??
        null;
    }

    return result;
  }, [currentFolder, folders]);

  const visibleFolders = useMemo(() => {
    if (selectedFolder === "uncategorized") return [];

    return folders.filter((folder) =>
      selectedFolder === "all"
        ? folder.parent_id === null
        : folder.parent_id === selectedFolder
    );
  }, [folders, selectedFolder]);

  const folderDescendants = useCallback(
    (folderId: string): Set<string> => {
      const result = new Set<string>([folderId]);
      const queue = [folderId];

      while (queue.length) {
        const parentId = queue.shift()!;

        folders
          .filter((folder) => folder.parent_id === parentId)
          .forEach((folder) => {
            if (!result.has(folder.id)) {
              result.add(folder.id);
              queue.push(folder.id);
            }
          });
      }

      return result;
    },
    [folders]
  );

  const filteredImages = useMemo(() => {
    const includedFolderIds =
      selectedFolder !== "all" &&
      selectedFolder !== "uncategorized"
        ? folderDescendants(selectedFolder)
        : null;

    const normalizedSearch = search.trim().toLowerCase();

    return images.filter((image) => {
      if (
        selectedFolder === "uncategorized" &&
        image.folder_id !== null
      ) {
        return false;
      }

      if (
        includedFolderIds &&
        (!image.folder_id ||
          !includedFolderIds.has(image.folder_id))
      ) {
        return false;
      }

      const isUsed = usedUrls.has(image.public_url);

      if (filter === "used" && !isUsed) return false;
      if (filter === "unused" && isUsed) return false;

      if (
        normalizedSearch &&
        !image.file_name.toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }

      return true;
    });
  }, [
    images,
    selectedFolder,
    folderDescendants,
    filter,
    search,
    usedUrls,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredImages.length / PAGE_SIZE)
  );

  const paginatedImages = filteredImages.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const changeFolder = (folder: FolderSelection) => {
    setSelectedFolder(folder);
    setPage(1);
    setFilter("all");
    setSearch("");
  };

  const handleCreateFolder = async () => {
  const name = newFolderName.trim();

  if (!name) {
    setError("Please enter a folder name.");
    return;
  }

  if (selectedFolder === "uncategorized") {
    setError("Select a folder or All Media before creating a folder.");
    return;
  }

  const parentId = selectedFolder === "all" ? null : selectedFolder;

  setCreatingFolder(true);
  setError(null);

  try {
    const { data, error: insertError } = await supabase
      .from("media_folders")
      .insert({
        name,
        parent_id: parentId,
      })
      .select("id, name, parent_id, created_at")
      .single();

    if (insertError) throw insertError;

    setFolders((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    );

    setNewFolderName("");
    setShowCreateFolder(false);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Failed to create folder"
    );
  } finally {
    setCreatingFolder(false);
  }
};

  const handleRenameFolder = async () => {
  if (!renamingFolder || savingRename) return;

  const name = renameValue.trim();

  if (!name) {
    setError("Folder name cannot be empty.");
    return;
  }

  if (name === renamingFolder.name) {
    setRenamingFolder(null);
    return;
  }

  setSavingRename(true);
  setError(null);

  try {
    const { data, error: updateError } = await supabase
      .from("media_folders")
      .update({ name })
      .eq("id", renamingFolder.id)
      .select("id, name, parent_id, created_at")
      .single();

    if (updateError) throw updateError;

    setFolders((prev) =>
      prev
        .map((folder) =>
          folder.id === data.id ? data : folder
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    );

    setRenamingFolder(null);
    setRenameValue("");
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to rename folder."
    );
  } finally {
    setSavingRename(false);
  }
};

  const handleDeleteFolder = async () => {
  if (!deletingFolder || processingDelete) return;

  setProcessingDelete(true);
  setError(null);

  try {
    const { data, error: deleteError } = await supabase
      .from("media_folders")
      .delete()
      .eq("id", deletingFolder.id)
      .select("id");

    if (deleteError) throw deleteError;

    if (!data || data.length !== 1) {
      throw new Error("Folder was not deleted. Please refresh and try again.");
    }

    setFolders((prev) =>
      prev.filter((folder) => folder.id !== deletingFolder.id)
    );

    if (selectedFolder === deletingFolder.id) {
      changeFolder(deletingFolder.parent_id ?? "all");
    }

    setDeletingFolder(null);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Failed to delete folder."
    );
  } finally {
    setProcessingDelete(false);
  }
};

  const handleMoveImage = async () => {
  if (!movingImage || processingMove) return;

  const newFolderId = targetFolderId || null;

  if (movingImage.folder_id === newFolderId) {
    setMovingImage(null);
    return;
  }

  setProcessingMove(true);
  setError(null);

  try {
    // Identify the image using its actual Storage location.
    const { data: existing, error: lookupError } = await supabase
      .from("media_assets")
      .select("id")
      .eq("storage_bucket", movingImage.storage_bucket)
      .eq("storage_path", movingImage.storage_path)
      .maybeSingle();

    if (lookupError) throw lookupError;

    let assetId: string;

    if (existing) {
      // Image already registered: update its folder.
      const { data, error: updateError } = await supabase
        .from("media_assets")
        .update({ folder_id: newFolderId })
        .eq("id", existing.id)
        .select("id")
        .single();

      if (updateError) throw updateError;

      assetId = data.id;
    } else {
      // Image exists in Storage but has no metadata record.
      const { data, error: insertError } = await supabase
        .from("media_assets")
        .insert({
          file_name: movingImage.file_name,
          storage_bucket: movingImage.storage_bucket,
          storage_path: movingImage.storage_path,
          public_url: movingImage.public_url,
          file_size: movingImage.file_size,
          mime_type: movingImage.mime_type,
          folder_id: newFolderId,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      assetId = data.id;
    }

    setImages((prev) =>
      prev.map((image) =>
        image.storage_bucket === movingImage.storage_bucket &&
        image.storage_path === movingImage.storage_path
          ? {
              ...image,
              id: assetId,
              folder_id: newFolderId,
            }
          : image
      )
    );

    setMovingImage(null);
    setTargetFolderId("");
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to move image."
    );
  } finally {
    setProcessingMove(false);
  }
};

  const handleDeleteImage = async () => {
  if (!deletingImage || processingImageDelete) return;

  setProcessingImageDelete(true);
  setError(null);

  try {
    const image = deletingImage;

    // 1. Check all category image references.
    const { data: categories, error: categoryError } = await supabase
      .from("categories")
      .select("image_url")
      .eq("image_url", image.public_url)
      .limit(1);

    if (categoryError) throw categoryError;

    if (categories && categories.length > 0) {
      throw new Error(
        "This image is used by a category and cannot be deleted."
      );
    }

    // 2. Check product image references.
    // JSONB containment checks whether the array includes this URL.
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id")
      .contains("images", JSON.stringify([image.public_url]))
      .limit(1);

    if (productError) throw productError;

    if (products && products.length > 0) {
      throw new Error(
        "This image is used by a product and cannot be deleted."
      );
    }

    // 3. Delete the actual Storage file.
    const { data: removedFiles, error: storageError } =
      await supabase.storage
        .from(image.storage_bucket)
        .remove([image.storage_path]);

    if (storageError) throw storageError;

    if (!removedFiles || removedFiles.length === 0) {
      throw new Error(
        "Storage did not confirm file deletion. Please refresh and verify."
      );
    }

    // 4. Remove the metadata record, if one exists.
    const { error: metadataError } = await supabase
      .from("media_assets")
      .delete()
      .eq("storage_bucket", image.storage_bucket)
      .eq("storage_path", image.storage_path);

    if (metadataError) {
      throw new Error(
        `The Storage file was deleted, but its metadata could not be removed: ${metadataError.message}`
      );
    }

    // 5. Refresh the Media Library.
    await fetchLibrary();

    setDeletingImage(null);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to delete image."
    );
  } finally {
    setProcessingImageDelete(false);
  }
};

  const handleUploadImages = async (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  const files = Array.from(event.target.files ?? []);
  event.target.value = "";

  if (!files.length || uploading) return;

  if (selectedFolder === "all") {
    setUploadError("Please select a folder before uploading images.");
    return;
  }

  setUploading(true);
  setUploadError(null);

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 2 * 1024 * 1024;

  try {
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`${file.name}: Unsupported image format.`);
      }

      if (file.size > maxSize) {
        throw new Error(`${file.name}: Maximum file size is 2 MB.`);
      }

      const extension =
        file.type === "image/jpeg"
          ? "jpg"
          : file.type === "image/png"
          ? "png"
          : "webp";

      const storagePath = `${crypto.randomUUID()}.${extension}`;

      const { error: storageError } = await supabase.storage
        .from("category-images")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from("category-images")
        .getPublicUrl(storagePath);

      const { error: databaseError } = await supabase
        .from("media_assets")
        .insert({
          file_name: file.name,
          storage_bucket: "category-images",
          storage_path: storagePath,
          public_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.type,
          folder_id:
            selectedFolder === "uncategorized"
              ? null
              : selectedFolder,
        });

      if (databaseError) {
        const { error: cleanupError } = await supabase.storage
          .from("category-images")
          .remove([storagePath]);

        if (cleanupError) {
          throw new Error(
            `Could not register ${file.name}, and Storage cleanup failed: ${cleanupError.message}`
          );
        }

        throw databaseError;
      }
    }
  } catch (err) {
    setUploadError(
      err instanceof Error ? err.message : "Image upload failed."
    );
  } finally {
    try {
    await fetchLibrary();
  } finally {
    setUploading(false);
  }
  }
};

  const folderImageCount = (folderId: string) => {
    const ids = folderDescendants(folderId);

    return images.filter(
      (image) => image.folder_id && ids.has(image.folder_id)
    ).length;
  };

  const formatSize = (bytes: number) =>
    `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif text-[#2B1F3D]">
              Media Library
            </h1>
            <p className="text-gray-500 mt-2">
              Organize and browse Carmin images.
            </p>
          </div>

          <button
  type="button"
  onClick={() => {
    setNewFolderName("");
    setError(null);
    setShowCreateFolder(true);
  }}
  disabled={selectedFolder === "uncategorized"}
  className="flex items-center gap-2 px-4 py-2 bg-[#960018] text-white rounded-lg hover:bg-[#7A0014] disabled:opacity-50"
>
  <FolderPlus size={16} />
  New Folder
</button>

          <label
  className={`flex items-center gap-2 px-4 py-2 bg-[#960018] text-white rounded-lg ${
    uploading || selectedFolder === "all"
      ? "opacity-50 cursor-not-allowed"
      : "cursor-pointer hover:bg-[#7A0014]"
  }`}
>
  {uploading ? (
    <Loader2 size={16} className="animate-spin" />
  ) : (
    <Upload size={16} />
  )}

  {uploading ? "Uploading..." : "Upload Images"}

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    multiple
    disabled={uploading || selectedFolder === "all"}
    onChange={(event) => void handleUploadImages(event)}
    className="hidden"
  />
</label>

          <button
            type="button"
            onClick={() => void fetchLibrary()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        {uploadError && (
  <div role="alert" className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
    {uploadError}
  </div>
)}

        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
          {/* Folder sidebar */}
          <aside className="bg-white border border-gray-200 rounded-xl p-4 self-start">
            <h2 className="text-sm font-semibold text-[#2B1F3D] mb-4">
              Folders
            </h2>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => changeFolder("all")}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${
                  selectedFolder === "all"
                    ? "bg-[#960018]/10 text-[#960018]"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <ImageIcon size={17} />
                All Media
                <span className="ml-auto text-xs">
                  {images.length}
                </span>
              </button>

              {folders
                .filter((folder) => folder.parent_id === null)
                .map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => changeFolder(folder.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${
                      selectedFolder === folder.id
                        ? "bg-[#960018]/10 text-[#960018]"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Folder size={17} className="shrink-0" />
                    <span className="truncate">{folder.name}</span>
                    <span className="ml-auto text-xs">
                      {folderImageCount(folder.id)}
                    </span>
                  </button>
                ))}

              <button
                type="button"
                onClick={() => changeFolder("uncategorized")}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${
                  selectedFolder === "uncategorized"
                    ? "bg-[#960018]/10 text-[#960018]"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FolderOpen size={17} />
                Uncategorized
                <span className="ml-auto text-xs">
                  {images.filter((image) => !image.folder_id).length}
                </span>
              </button>
            </div>
          </aside>

          {/* Folder contents */}
          <main className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-5 text-sm">
              <button
                type="button"
                onClick={() => changeFolder("all")}
                className="text-[#960018] hover:underline"
              >
                Media Library
              </button>

              {selectedFolder === "uncategorized" ? (
                <>
                  <ChevronRight size={14} />
                  <span>Uncategorized</span>
                </>
              ) : (
                breadcrumbs.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center gap-2"
                  >
                    <ChevronRight size={14} />
                    <button
                      type="button"
                      onClick={() => changeFolder(folder.id)}
                      className="hover:text-[#960018]"
                    >
                      {folder.name}
                    </button>
                  </div>
                ))
              )}
            </div>

            {selectedFolder !== "all" && (
              <button
                type="button"
                onClick={() =>
                  changeFolder(
                    currentFolder?.parent_id ?? "all"
                  )
                }
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#960018] mb-5"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            )}

            {visibleFolders.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {visibleFolders.map((folder) => (
  <div
    key={folder.id}
    className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl bg-white hover:border-[#960018]/40 hover:shadow-sm transition"
  >
    <button
      type="button"
      onClick={() => changeFolder(folder.id)}
      className="flex items-center gap-3 flex-1 min-w-0 text-left"
    >
      <Folder
        size={26}
        className="text-[#960018] shrink-0"
      />

      <div className="min-w-0">
        <p className="font-medium text-sm text-[#2B1F3D] truncate">
          {folder.name}
        </p>

        <p className="text-xs text-gray-500">
          {folderImageCount(folder.id)} images
        </p>
      </div>
    </button>

    <button
      type="button"
      title={`Rename ${folder.name}`}
      aria-label={`Rename ${folder.name}`}
      onClick={() => {
        setRenamingFolder(folder);
        setRenameValue(folder.name);
        setError(null);
      }}
      className="p-2 text-gray-500 hover:text-[#960018] hover:bg-gray-100 rounded-lg"
    >
      <Pencil size={16} />
    </button>
    <button
  type="button"
  title={`Delete ${folder.name}`}
  aria-label={`Delete ${folder.name}`}
  onClick={() => {
    setDeletingFolder(folder);
    setError(null);
  }}
  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
>
  <Trash2 size={16} />
</button>
  </div>
))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex gap-2">
                {(["all", "used", "unused"] as const).map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setFilter(option);
                        setPage(1);
                      }}
                      className={`px-3 py-2 rounded-lg text-xs capitalize ${
                        filter === option
                          ? "bg-[#960018] text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {option}
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white">
                <Search size={16} className="text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search images..."
                  className="outline-none text-sm w-40"
                />
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              {filteredImages.length} images
            </p>

            {loading ? (
              <p className="text-gray-500">Loading images...</p>
            ) : paginatedImages.length === 0 ? (
              <div className="py-16 text-center text-gray-500 bg-white border border-gray-200 rounded-xl">
                <ImageIcon size={40} className="mx-auto mb-3" />
                No images found in this view.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedImages.map((image) => {
                  const isUsed = usedUrls.has(image.public_url);

                  return (
                    <div
                      key={image.id}
                      className="border border-gray-200 rounded-xl overflow-hidden bg-white"
                    >
                      <div className="aspect-square bg-gray-50">
                        <img
                          src={image.public_url}
                          alt={image.file_name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="p-3">
                        <p
                          className="text-sm font-medium text-gray-800 truncate"
                          title={image.file_name}
                        >
                          {image.file_name}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          {formatSize(image.file_size)}
                        </p>

                        <span
                          className={`inline-block mt-3 text-xs px-2 py-1 rounded-full ${
                            isUsed
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {isUsed ? "In Use" : "Unused"}
                        </span>
                        <div className="flex items-center gap-2 mt-3">
  {/* Move to Folder */}
  <button
    type="button"
    onClick={() => {
      setMovingImage(image);
      setTargetFolderId(image.folder_id ?? "");
      setError(null);
    }}
    className="flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-[#960018] hover:text-[#960018] transition"
  >
    <FolderInput size={16} className="shrink-0" />
    <span>Move to Folder</span>
  </button>

  {/* Delete Image */}
  <button
    type="button"
    title="Delete Image"
    aria-label={`Delete ${image.file_name}`}
    onClick={() => {
      setDeletingImage(image);
      setError(null);
    }}
    className="shrink-0 flex items-center justify-center w-10 h-10 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition"
  >
    <Trash2 size={17} />
  </button>
</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 border rounded-lg disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 border rounded-lg disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
      {showCreateFolder && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-serif text-[#2B1F3D]">
          Create New Folder
        </h2>

        <button
          type="button"
          onClick={() => setShowCreateFolder(false)}
          disabled={creatingFolder}
          className="text-gray-500 hover:text-gray-900"
        >
          <X size={20} />
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Location:{" "}
        <span className="font-medium text-[#2B1F3D]">
          {selectedFolder === "all"
            ? "Media Library"
            : currentFolder?.name ?? "Media Library"}
        </span>
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreateFolder();
        }}
      >
        <label
          htmlFor="new-folder-name"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Folder Name
        </label>

        <input
          id="new-folder-name"
          type="text"
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder="e.g. Ceramic Vases"
          maxLength={100}
          autoFocus
          className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#960018]"
        />

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => setShowCreateFolder(false)}
            disabled={creatingFolder}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={creatingFolder || !newFolderName.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-[#960018] text-white rounded-lg disabled:opacity-50"
          >
            {creatingFolder && (
              <Loader2 size={16} className="animate-spin" />
            )}
            Create Folder
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {renamingFolder && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-serif text-[#2B1F3D]">
          Rename Folder
        </h2>

        <button
          type="button"
          disabled={savingRename}
          onClick={() => setRenamingFolder(null)}
          className="text-gray-500 hover:text-gray-900"
        >
          <X size={20} />
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleRenameFolder();
        }}
      >
        <label
          htmlFor="rename-folder-name"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Folder Name
        </label>

        <input
          id="rename-folder-name"
          type="text"
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          maxLength={100}
          autoFocus
          className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-[#960018]"
        />

        {error && (
          <p role="alert" className="text-sm text-red-600 mt-3">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            disabled={savingRename}
            onClick={() => setRenamingFolder(null)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={savingRename || !renameValue.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-[#960018] text-white rounded-lg disabled:opacity-50"
          >
            {savingRename && (
              <Loader2 size={16} className="animate-spin" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
)}
      {deletingFolder && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
      <h2 className="text-xl font-serif text-[#2B1F3D] mb-3">
        Delete Folder
      </h2>

      <p className="text-sm text-gray-600 mb-4">
        Are you sure you want to delete{" "}
        <strong>{deletingFolder.name}</strong>?
      </p>

      <p className="text-sm text-gray-500 mb-5">
        Only empty folders can be deleted. Images and subfolders
        must be moved or removed first.
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          disabled={processingDelete}
          onClick={() => {
            setDeletingFolder(null);
            setError(null);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={processingDelete}
          onClick={() => void handleDeleteFolder()}
          className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {processingDelete && (
            <Loader2 size={16} className="animate-spin" />
          )}
          Delete Folder
        </button>
      </div>
    </div>
  </div>
)}
      {movingImage && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
      <h2 className="text-xl font-serif text-[#2B1F3D] mb-3">
        Move Image
      </h2>

      <p className="text-sm text-gray-500 mb-5 truncate">
        {movingImage.file_name}
      </p>

      <label
        htmlFor="target-folder"
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Destination Folder
      </label>

      <select
        id="target-folder"
        value={targetFolderId}
        onChange={(event) => setTargetFolderId(event.target.value)}
        className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white outline-none focus:border-[#960018]"
      >
        <option value="">Uncategorized</option>

        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
      </select>

      {error && (
        <p role="alert" className="text-sm text-red-600 mt-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          disabled={processingMove}
          onClick={() => {
            setMovingImage(null);
            setTargetFolderId("");
            setError(null);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={processingMove}
          onClick={() => void handleMoveImage()}
          className="flex items-center gap-2 px-5 py-2 bg-[#960018] text-white rounded-lg disabled:opacity-50"
        >
          {processingMove && (
            <Loader2 size={16} className="animate-spin" />
          )}
          Move Image
        </button>
      </div>
    </div>
  </div>
)}

      {deletingImage && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
      <h2 className="text-xl font-serif text-[#2B1F3D] mb-4">
        Delete Image
      </h2>

      <div className="flex items-center gap-4 mb-5">
        <img
          src={deletingImage.public_url}
          alt={deletingImage.file_name}
          className="w-20 h-20 object-cover rounded-lg border border-gray-200"
        />

        <div className="min-w-0">
          <p className="font-medium text-sm text-gray-800 break-all">
            {deletingImage.file_name}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Bucket: {deletingImage.storage_bucket}
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        Are you sure you want to permanently delete this image?
      </p>

      <p className="text-sm text-red-600 mb-5">
        This will remove the actual file from Supabase Storage.
        This action cannot be undone.
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          disabled={processingImageDelete}
          onClick={() => {
            setDeletingImage(null);
            setError(null);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={processingImageDelete}
          onClick={() => void handleDeleteImage()}
          className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {processingImageDelete ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={16} />
          )}

          {processingImageDelete ? "Deleting..." : "Delete Image"}
        </button>
      </div>
    </div>
  </div>
)}
    </AdminLayout>
  );
}
