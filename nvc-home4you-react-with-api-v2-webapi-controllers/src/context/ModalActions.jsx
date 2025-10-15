import React, { createContext, useContext, useMemo } from 'react'

const ModalActionsContext = createContext({ openOffer: ()=>{}, openQuestion: ()=>{} })

export function ModalActionsProvider({ onOpenOffer, onOpenQuestion, children }){
  const value = useMemo(()=>({ openOffer:onOpenOffer, openQuestion:onOpenQuestion }), [onOpenOffer, onOpenQuestion])
  return <ModalActionsContext.Provider value={value}>{children}</ModalActionsContext.Provider>
}

export function useModalActions(){
  const ctx = useContext(ModalActionsContext)
  if(!ctx) throw new Error('useModalActions must be used within <ModalActionsProvider>')
  return ctx
}
