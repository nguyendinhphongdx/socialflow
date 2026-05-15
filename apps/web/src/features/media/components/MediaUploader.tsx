'use client'
import { useCallback, useRef, useState } from 'react'
import { useMediaUpload } from '../hooks/useMediaUpload'
import type { MediaAsset } from '../types'

interface MediaUploaderProps {
  /** Callback khi upload xong — trả về MediaAsset list. */
  onUploaded: (assets: MediaAsset[]) => void
  /** Accept attribute cho input file (vd: 'video/*,image/*'). Default = '*'. */
  accept?: string
  /** Multiple files. Default: false. */
  multiple?: boolean
  /** Disabled trạng thái. */
  disabled?: boolean
}

export function MediaUploader({ onUploaded, accept = 'image/*,video/*', multiple = false, disabled }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const { uploadFiles, progress, isUploading } = useMediaUpload()

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    const assets = await uploadFiles(files)
    if (assets.length > 0) onUploaded(assets)
  }, [uploadFiles, onUploaded])

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    handleFiles(files)
    e.target.value = ''     // reset để re-upload cùng file được
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={disabled || isUploading}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm transition-colors ${
          dragOver ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="text-2xl">📁</span>
        <span className="font-medium">
          {isUploading ? 'Đang upload...' : 'Click hoặc kéo file vào đây'}
        </span>
        <span className="text-xs text-muted-foreground">
          {accept.includes('video') && 'video/'}
          {accept.includes('image') && 'image/'}
          {accept.includes('audio') && 'audio'}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onSelect}
        className="hidden"
        disabled={disabled}
      />

      {progress.length > 0 && (
        <ul className="space-y-1.5">
          {progress.map((p, i) => (
            <li key={i} className="rounded-md border border-border bg-card p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="truncate font-medium">{p.filename}</span>
                <span className="ml-2 text-muted-foreground">
                  {p.status === 'done' ? '✓' : p.status === 'error' ? '✕' : `${Math.round((p.loaded / Math.max(p.total, 1)) * 100)}%`}
                </span>
              </div>
              {p.status !== 'done' && p.status !== 'error' && (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${(p.loaded / Math.max(p.total, 1)) * 100}%` }}
                  />
                </div>
              )}
              {p.error && <p className="mt-1 text-destructive">{p.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
