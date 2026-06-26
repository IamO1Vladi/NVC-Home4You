import React from 'react'
import GalleryRoutes from '../gallery/GalleryRoutes.jsx'
import content from '../../content/el/gallery.js'

export default function ElGalleryRoute({ onRequestModel }) {
  return (
    <GalleryRoutes
      locale="el"
      content={content}
      basePath="https://nvc-home4you.eu/el/gkaleri"
      homeUrl="https://nvc-home4you.eu/el"
      onRequestModel={onRequestModel}
    />
  )
}
