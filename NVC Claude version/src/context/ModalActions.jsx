import React, { createContext, useContext, useMemo } from 'react'

// requestModel opens the offer form with one product attached ({ id, title, titleBg, path,
// catalogId }, the shape App's requestModel takes), so an enquiry from a product page's
// card reaches sales naming the house, the way a gallery enquiry does. A provider that is
// not handed one (the page tests) falls back to the plain offer form rather than a no-op,
// so the button still does something visible.
const noop = ()=>{}
const ModalActionsContext = createContext({ openOffer: noop, openQuestion: noop, requestModel: noop })

export function ModalActionsProvider({ onOpenOffer, onOpenQuestion, onRequestModel, children }){
  const value = useMemo(()=>({
    openOffer:onOpenOffer,
    openQuestion:onOpenQuestion,
    requestModel:onRequestModel || (()=>onOpenOffer?.()),
  }), [onOpenOffer, onOpenQuestion, onRequestModel])
  return <ModalActionsContext.Provider value={value}>{children}</ModalActionsContext.Provider>
}

export function useModalActions(){
  const ctx = useContext(ModalActionsContext)
  if(!ctx) throw new Error('useModalActions must be used within <ModalActionsProvider>')
  return ctx
}
