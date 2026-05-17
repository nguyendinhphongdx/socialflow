'use client'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { MediaUploader, type MediaAsset } from '@/features/media'

interface MediaPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (assets: MediaAsset[]) => void
  multiple?: boolean
  accept?: string                            // filter MIME prefix vd 'video/'
}

export function MediaPickerModal({ open, onClose, onSelect, multiple = true, accept }: MediaPickerModalProps) {
  const [selected, setSelected] = useState<MediaAsset[]>([])
  const [tab, setTab] = useState<'library' | 'upload'>('library')

  const { data, refetch } = useQuery({
    queryKey: ['media', 'library', { accept }],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { list: MediaAsset[] } }>('/media', {
        params: { pageSize: 50, status: 'UPLOADED' },
      })
      return res.data.data
    },
    enabled: open && tab === 'library',
  })

  useEffect(() => { if (!open) setSelected([]) }, [open])

  if (!open) return null

  function toggle(asset: MediaAsset) {
    if (multiple) {
      setSelected(prev => prev.some(p => p.id === asset.id)
        ? prev.filter(p => p.id !== asset.id)
        : [...prev, asset])
    }
    else {
      setSelected([asset])
    }
  }

  function confirm() {
    onSelect(selected)
    onClose()
  }

  function onUploaded(newAssets: MediaAsset[]) {
    setSelected(prev => [...prev, ...newAssets])
    setTab('library')
    refetch()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-card shadow-xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">Chọn media</h2>
          <button type="button" onClick={onClose} className="text-2xl text-muted-foreground">×</button>
        </header>

        <div className="flex gap-2 border-b border-border px-4">
          <TabButton active={tab === 'library'} onClick={() => setTab('library')}>Thư viện</TabButton>
          <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>Upload mới</TabButton>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {tab === 'library' && (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {data?.list.map(asset => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => toggle(asset)}
                  className={`group relative aspect-square overflow-hidden rounded-md border-2 ${
                    selected.some(s => s.id === asset.id) ? 'border-primary' : 'border-transparent hover:border-border'
                  }`}
                >
                  {asset.type === 'IMAGE'
                    ? <img src={asset.publicUrl} alt="" className="h-full w-full object-cover" />
                    : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-3xl">
                        {asset.type === 'VIDEO' ? '🎬' : '🎵'}
                      </div>
                    )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-left text-xs text-white">
                    <p className="truncate">{asset.filename}</p>
                  </div>
                </button>
              ))}
              {!data && <p className="col-span-full text-center text-muted-foreground">Đang tải...</p>}
              {data && data.list.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground">Chưa có media nào — chuyển tab Upload</p>
              )}
            </div>
          )}

          {tab === 'upload' && (
            <MediaUploader accept={accept ?? 'image/*,video/*'} multiple={multiple} onUploaded={onUploaded} />
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border p-4">
          <p className="text-sm text-muted-foreground">{selected.length} đã chọn</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent">Huỷ</button>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={confirm}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Chèn {selected.length > 0 ? `(${selected.length})` : ''}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium ${
        active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
