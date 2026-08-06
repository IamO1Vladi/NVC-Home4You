import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import AdminModal from './AdminModal.jsx'

// The dialog shipped transparent and unusable once. It renders through createPortal into
// document.body, so it sits OUTSIDE .adm-app — where every --adm-* token is declared. The
// tokens resolved to nothing, the background disappeared and the text fell back to the
// marketing site's pale body colour.
//
// jsdom does not do cascade or custom properties, so this cannot be caught by rendering.
// It is checked against the stylesheet itself, which is where the mistake actually lives.

// vitest runs from the SPA project root, and import.meta.url is not a file: URL here.
// Comments are stripped first: the selector match reads the text before each `{`, and the
// comment explaining this very rule names .adm-modal-portal — which made the first version
// of this test pass against the broken stylesheet.
const css = readFileSync(resolve(process.cwd(), 'src/style/Admin.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

describe('Admin.css token scope', () => {
  it('declares the admin tokens for the portalled dialog, not only inside .adm-app', () => {
    // Every selector list that opens a --adm-bg declaration must cover the portal, because
    // the dialog can never inherit from .adm-app.
    const blocks = [...css.matchAll(/([^{}]+)\{[^{}]*--adm-bg:/g)].map((m) => m[1])

    expect(blocks.length).toBeGreaterThan(0)
    for (const selectors of blocks) {
      expect(selectors).toContain('.adm-modal-portal')
    }
  })

  it('gives the dialog an opaque background rather than leaving it to inherit', () => {
    const rule = css.match(/\.adm-modal\s*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toMatch(/background:\s*var\(--adm-card\)/)
    expect(rule).toMatch(/color:\s*var\(--adm-ink\)/)
  })
})

describe('AdminModal', () => {
  afterEach(cleanup)

  it('renders nothing at all when closed', () => {
    render(<AdminModal open={false} title="Edit" onClose={() => {}}>body</AdminModal>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('is a labelled modal dialog when open', () => {
    render(<AdminModal open title="Нов модел" onClose={() => {}}>body</AdminModal>)

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // The label has to resolve to a real element, or screen readers announce nothing.
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(document.getElementById(labelId)?.textContent).toBe('Нов модел')
  })

  it('puts the footer content where it cannot scroll away', () => {
    render(
      <AdminModal open title="Edit" onClose={() => {}} footer={<button type="button">Запази</button>}>
        body
      </AdminModal>,
    )
    const save = screen.getByRole('button', { name: 'Запази' })
    expect(save.closest('.adm-modal-foot')).not.toBeNull()
  })
})
