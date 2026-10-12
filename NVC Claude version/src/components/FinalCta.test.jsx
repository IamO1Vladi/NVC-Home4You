import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import FinalCta from './FinalCta.jsx'
import bgHome from '../content/bg/home.js'

// The closing contact card, shared by home and the product pages. HomePage.test.jsx pins the
// home page's copy of it; this pins what a product page gets by passing only a locale.

function renderCta(props = {}, actions = {}) {
  const onOpenOffer = actions.onOpenOffer || vi.fn()
  const onOpenQuestion = actions.onOpenQuestion || vi.fn()
  const utils = render(
    <ModalActionsProvider onOpenOffer={onOpenOffer} onOpenQuestion={onOpenQuestion}>
      <FinalCta locale="bg" {...props} />
    </ModalActionsProvider>,
  )
  return { ...utils, onOpenOffer, onOpenQuestion }
}

describe('FinalCta', () => {
  const copy = bgHome.home.finalCta

  it('falls back to the locale home copy and its business object', () => {
    const { container } = renderCta()
    const section = container.querySelector('section#final-cta')
    expect(section).toHaveAttribute('aria-labelledby', 'hp-final-title')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(copy.title)
    expect(container.querySelector('a[href^="tel:"]')).toHaveAttribute('href', 'tel:+359879355269')
    expect(container.querySelector('a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:contact@nvc-home4you.eu')
    expect(container.querySelector('.hp-where')).toHaveTextContent(copy.where)
  })

  it('takes a title and id override and keeps the rest', () => {
    const { container } = renderCta({ id: 'pp-final', titleId: 'pp-final-title', title: 'Да поговорим за вашия контейнер?' })
    expect(container.querySelector('section#pp-final')).toHaveAttribute('aria-labelledby', 'pp-final-title')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Да поговорим за вашия контейнер?')
    expect(container.querySelector('.hp-sub')).toHaveTextContent(copy.desc)
  })

  it('opens the offer and question forms from real buttons', () => {
    const { onOpenOffer, onOpenQuestion } = renderCta()
    fireEvent.click(screen.getByRole('button', { name: copy.primaryCta }))
    fireEvent.click(screen.getByRole('button', { name: copy.secondaryCta }))
    expect(onOpenOffer).toHaveBeenCalledTimes(1)
    expect(onOpenQuestion).toHaveBeenCalledTimes(1)
  })

  it('lets a page send the primary button elsewhere', () => {
    const onPrimary = vi.fn()
    const { onOpenOffer } = renderCta({ onPrimary })
    fireEvent.click(screen.getByRole('button', { name: copy.primaryCta }))
    expect(onPrimary).toHaveBeenCalledTimes(1)
    expect(onOpenOffer).not.toHaveBeenCalled()
  })
})
