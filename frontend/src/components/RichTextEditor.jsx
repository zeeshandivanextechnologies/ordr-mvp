import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FiBold, FiItalic, FiUnderline, FiList, FiLink, FiRotateCcw, FiRotateCw } from 'react-icons/fi';
import { MdFormatListNumbered, MdLinkOff, MdTitle } from 'react-icons/md';

// Rich-text editor for CMS content (legal pages). Only simple formatting is offered:
// bold, italic, underline, sub-heading, bullet / numbered lists and links.
export default function RichTextEditor({ value, onChange, id }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [4] },
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? '' : ed.getHTML()),
    editorProps: { attributes: { class: 'rte-content', id, 'aria-label': 'Section text' } },
  });

  // Content replaced from outside (reset, switching page): show it in the editor
  useEffect(() => {
    if (editor && !editor.isDestroyed && (value || '') !== (editor.isEmpty ? '' : editor.getHTML())) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const current = editor.getAttributes('link').href || '';
    const url = window.prompt('Link address (https://..., /privacy-policy or mailto:...)', current);
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = url.trim();
    const external = /^https?:\/\//i.test(href);
    editor.chain().focus().extendMarkRange('link')
      .setLink({ href, target: external ? '_blank' : null, rel: external ? 'noopener noreferrer' : null })
      .run();
  };

  const buttons = [
    { title: 'Bold', icon: <FiBold />, active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { title: 'Italic', icon: <FiItalic />, active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { title: 'Underline', icon: <FiUnderline />, active: editor.isActive('underline'), run: () => editor.chain().focus().toggleUnderline().run() },
    { title: 'Sub-heading', icon: <MdTitle />, active: editor.isActive('heading', { level: 4 }), run: () => editor.chain().focus().toggleHeading({ level: 4 }).run() },
    { title: 'Bullet list', icon: <FiList />, active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { title: 'Numbered list', icon: <MdFormatListNumbered />, active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { title: 'Add / edit link', icon: <FiLink />, active: editor.isActive('link'), run: setLink },
    { title: 'Remove link', icon: <MdLinkOff />, active: false, disabled: !editor.isActive('link'), run: () => editor.chain().focus().unsetLink().run() },
    { title: 'Undo', icon: <FiRotateCcw />, active: false, disabled: !editor.can().undo(), run: () => editor.chain().focus().undo().run() },
    { title: 'Redo', icon: <FiRotateCw />, active: false, disabled: !editor.can().redo(), run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        {buttons.map((b) => (
          <button
            key={b.title}
            type="button"
            title={b.title}
            aria-label={b.title}
            aria-pressed={b.active}
            className={`rte-btn${b.active ? ' active' : ''}`}
            disabled={b.disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={b.run}
          >
            {b.icon}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
