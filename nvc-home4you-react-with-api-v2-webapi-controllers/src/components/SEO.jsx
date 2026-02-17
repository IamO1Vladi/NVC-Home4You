// src/components/SEO.jsx
import { Helmet } from 'react-helmet-async'

export default function SEO({
  title, description, image, url, locale='bg_BG', type='website',
  canonical, noindex=false, hreflangs=[]
}){
  const abs = (p)=> p?.startsWith('http') ? p : (window?.location?.origin + p)
  const ogImg = 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcy/eg/vb' //abs(image || '/og/default.jpg')
  const can   = canonical || url || (typeof window!=='undefined' ? window.location.href : undefined)

  return (
    <Helmet>


      {/* Open Graph */}
      <meta property="og:site_name" content="NVC Home4You" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcy/eg/vb'} />
      <meta property="og:url" content={url} />
      

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />

      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}

      {/* Open Graph / Twitter */}
      <meta property="og:type" content={type} />
      {url && <meta property="og:url" content={url} />}
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image" content={ogImg} />
      <meta name="twitter:card" content="summary_large_image" />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImg} />
      <meta property="og:image" content="https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcy/eg/vb" />

      {/* Canonical + hreflang */}
      {can && <link rel="canonical" href={can} />}
      {hreflangs.map(h=> <link key={h.hrefLang} rel="alternate" hrefLang={h.hrefLang} href={h.href} />)}

      {/* Robots */}
      {noindex && <meta name="robots" content="index,nofollow, max-image-preview:large" />}
    </Helmet>
  )
}
