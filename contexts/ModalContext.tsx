'use client'
import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface ModalProps {
  title: string
  message: string
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
}

interface ModalContextType {
  showModal: (props: ModalProps) => void
  hideModal: () => void
  modalProps: ModalProps | null
  isVisible: boolean
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalProps, setModalProps] = useState<ModalProps | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const showModal = (props: ModalProps) => {
    setModalProps(props)
    setIsVisible(true)
  }

  const hideModal = () => {
    setIsVisible(false)
    setTimeout(() => {
      setModalProps(null)
    }, 300)
  }

  return (
    <ModalContext.Provider value={{ showModal, hideModal, modalProps, isVisible }}>
      {children}
    </ModalContext.Provider>
  )
}

export const useModal = () => {
  const context = useContext(ModalContext)
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}