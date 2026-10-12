import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { ModalActionsProvider, useModalActions } from './ModalActions.jsx'

// requestModel reaches a product page's card through the context, carrying the model to the
// offer form; a provider without one still opens the plain form.

function Probe({ model }) {
  const { requestModel } = useModalActions()
  return <button type="button" onClick={() => requestModel(model)}>Ask</button>
}

describe('ModalActions requestModel', () => {
  const model = { id: 13, title: 'Container House', titleBg: 'Жилищен фургон', path: '/bg/galeriq/x', catalogId: '' }

  it('hands the model to the app’s requestModel', () => {
    const onRequestModel = vi.fn()
    const onOpenOffer = vi.fn()
    render(
      <ModalActionsProvider onOpenOffer={onOpenOffer} onOpenQuestion={() => {}} onRequestModel={onRequestModel}>
        <Probe model={model} />
      </ModalActionsProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(onRequestModel).toHaveBeenCalledWith(model)
    expect(onOpenOffer).not.toHaveBeenCalled()
  })

  it('opens the plain offer form when the provider has no requestModel', () => {
    const onOpenOffer = vi.fn()
    render(
      <ModalActionsProvider onOpenOffer={onOpenOffer} onOpenQuestion={() => {}}>
        <Probe model={model} />
      </ModalActionsProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(onOpenOffer).toHaveBeenCalledTimes(1)
  })
})
