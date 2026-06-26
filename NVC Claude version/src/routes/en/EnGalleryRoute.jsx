import React from 'react'
import GalleryRoutes from '../gallery/GalleryRoutes.jsx'
import content from '../../content/en/gallery.js'

export default function EnGalleryRoute({ onRequestModel }) {
  return (
    <GalleryRoutes
      locale="en"
      content={content}
      basePath="https://nvc-home4you.eu/en/gallery"
      homeUrl="https://nvc-home4you.eu/en"
      onRequestModel={onRequestModel}
    />
  )
}
