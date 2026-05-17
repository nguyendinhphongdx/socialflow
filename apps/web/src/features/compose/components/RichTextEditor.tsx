'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  disabled?: boolean
}

export function RichTextEditor({ value, onChange, placeholder = 'Nhập nội dung...', maxLength, disabled }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, blockquote: false }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'text-primary underline' } }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[180px] focus:outline-none p-3',
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      if (maxLength && text.length > maxLength) {
        // hard cap — không cho vượt
        editor.commands.setContent(value, false)
        return
      }
      onChange(editor.getHTML())
    },
    editable: !disabled,
    immediatelyRender: false,
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false)
    }
  }, [value, editor])

  if (!editor) return null

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex flex-wrap gap-1 border-b border-border p-2 text-xs">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>B</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>I</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>S</ToolbarButton>
        <span className="mx-1 self-center text-muted-foreground">|</span>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>•</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>1.</ToolbarButton>
        <span className="mx-1 self-center text-muted-foreground">|</span>
        <ToolbarButton
          onClick={() => {
            const url = window.prompt('URL:')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          active={editor.isActive('link')}
        >
          🔗
        </ToolbarButton>
        <div className="ml-auto flex items-center text-muted-foreground">
          {editor.getText().length}{maxLength ? ` / ${maxLength}` : ''}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({ children, onClick, active }: { children: React.ReactNode, onClick: () => void, active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 font-bold ${active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
    >
      {children}
    </button>
  )
}
