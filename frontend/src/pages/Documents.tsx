import { useState, useEffect, useCallback, useRef } from 'react'
import {
  apiListDocuments,
  apiUploadDocument,
  apiDeleteDocument,
  apiGetDocumentStatus,
  type DocumentItem,
} from '../services/api'

const STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-50 text-blue-700',
  indexing: 'bg-amber-50 text-amber-700',
  ready: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
  deleting: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  indexing: 'Indexing',
  ready: 'Ready',
  failed: 'Failed',
  deleting: 'Deleting',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(contentType: string): string {
  if (contentType.includes('pdf')) return '📄'
  if (contentType.includes('word') || contentType.includes('docx')) return '📝'
  if (contentType.includes('markdown') || contentType.includes('md')) return '📋'
  return '📃'
}

export default function Documents() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiListDocuments()
      setDocuments(res.documents)
      setTotal(res.total)
      setError('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Poll processing documents
  useEffect(() => {
    const processing = documents.filter(
      (d) => d.status === 'processing' || d.status === 'indexing' || d.status === 'uploaded'
    )
    if (processing.length === 0) return

    const interval = setInterval(async () => {
      for (const doc of processing) {
        try {
          const status = await apiGetDocumentStatus(doc.id)
          if (status.status === 'completed' || status.status === 'failed') {
            fetchDocuments()
            break
          }
        } catch {
          // ignore polling errors
        }
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [documents, fetchDocuments])

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setUploadProgress(0)
    setError('')

    try {
      await apiUploadDocument(selectedFile, setUploadProgress)
      setShowUpload(false)
      setSelectedFile(null)
      setUploadProgress(0)
      fetchDocuments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    setDeleting(true)
    try {
      await apiDeleteDocument(docId)
      setDeleteConfirm(null)
      fetchDocuments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload documents and make them searchable with AI.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-zinc-900 dark:bg-white text-zinc-900 dark:text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors flex items-center gap-2"
        >
          <span>+</span> Upload Document
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h2>

            {!selectedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="text-3xl block mb-3">📁</span>
                <p className="text-sm text-gray-600 mb-1">
                  Drag and drop a file here, or click to browse
                </p>
                <p className="text-xs text-zinc-500">PDF, DOCX, TXT, MD — up to 50 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {fileIcon(selectedFile.type || selectedFile.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatSize(selectedFile.size)} · {selectedFile.type || 'Unknown type'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-zinc-500 hover:text-gray-600 p-1"
                  >
                    ✕
                  </button>
                </div>

                {uploading && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => {
                  setShowUpload(false)
                  setSelectedFile(null)
                }}
                disabled={uploading}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="px-5 py-2 bg-zinc-900 dark:bg-white text-zinc-900 dark:text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Document</h2>
            <p className="text-sm text-gray-500 mb-6">
              All indexed content associated with this document will also be removed. This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 text-zinc-900 dark:text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-4 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <span className="text-4xl block mb-4">📄</span>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Upload your first document to get started.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="text-sm font-medium text-zinc-900 dark:text-white hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            + Upload Document
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:border-gray-300 transition-colors"
            >
              <span className="text-2xl flex-shrink-0">{fileIcon(doc.content_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.original_filename}
                </p>
                <p className="text-xs text-gray-500">
                  {formatSize(doc.file_size)} ·{' '}
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  STATUS_COLORS[doc.status] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {(doc.status === 'processing' || doc.status === 'indexing') && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />
                )}
                {STATUS_LABELS[doc.status] || doc.status}
              </span>
              {(doc.status === 'processing' || doc.status === 'indexing') && (
                <div className="w-4 h-4 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin" />
              )}
              <button
                onClick={() => setDeleteConfirm(doc.id)}
                className="text-zinc-500 hover:text-red-500 p-1 transition-colors"
                title="Delete document"
              >
                🗑️
              </button>
            </div>
          ))}
          <p className="text-xs text-zinc-500 text-center pt-2">{total} document{total !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}
