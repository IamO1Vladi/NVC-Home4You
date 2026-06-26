import React from 'react'
import GalleryRoutes from '../gallery/GalleryRoutes.jsx'
import content from '../../content/bg/gallery.js'

export default function BgGalleryRoute({ onRequestModel }) {
  return (
    <GalleryRoutes
      locale="bg"
      content={content}
      basePath="https://nvc-home4you.eu/bg/galeriq"
      homeUrl="https://nvc-home4you.eu/bg"
      onRequestModel={onRequestModel}
    />
  )
}
