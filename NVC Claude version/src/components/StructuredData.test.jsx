import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ORGANIZATION_ID, ProductsJSONLD, ServiceJSONLD } from './StructuredData.jsx'

// Product markup as the product pages and /bg/ceni publish it: euro, absolute URLs, one
// fragment per @id, and no return policy nobody declared.

function ld(items, props = {}) {
  const { container } = render(<ProductsJSONLD items={items} listName="Containers" listUrl="/bg/modulni-postroiki" {...props} />)
  const script = container.querySelector('script[type="application/ld+json"]')
  return script ? JSON.parse(script.textContent) : null
}

const container6x3 = {
  id: 'gal-13',
  url: '/bg/galeriq/жилищен-фургон-6000мм-3000мм',
  name: 'Жилищен фургон - 6000мм*3000мм',
  description: 'Поцинкована стоманена рамка 2,3 мм.',
  image: '/api/img/gallery/1/a.webp',
  price: 4300,
}

describe('ProductsJSONLD', () => {
  it('publishes the price in EUR with absolute urls', () => {
    const data = ld([container6x3])
    expect(data['@type']).toBe('ItemList')
    expect(data.url).toBe('https://nvc-home4you.eu/bg/modulni-postroiki')

    const product = data.itemListElement[0].item
    expect(product.url).toBe('https://nvc-home4you.eu/bg/galeriq/жилищен-фургон-6000мм-3000мм')
    expect(product['@id']).toBe('https://nvc-home4you.eu/bg/galeriq/жилищен-фургон-6000мм-3000мм#product')
    expect(product.image).toEqual(['https://nvc-home4you.eu/api/img/gallery/1/a.webp'])
    expect(product.offers).toMatchObject({ priceCurrency: 'EUR', price: 4300, url: product.url })
  })

  it('declares no return policy unless the caller passes one', () => {
    const product = ld([container6x3]).itemListElement[0].item
    expect(product.offers.hasMerchantReturnPolicy).toBeUndefined()
    expect(JSON.stringify(product)).not.toContain('MerchantReturnNotPermitted')
  })

  it('keeps one fragment in the @id when the url is an anchor on a list page (the prices page)', () => {
    const product = ld([{ ...container6x3, url: 'https://nvc-home4you.eu/bg/ceni#item-13' }]).itemListElement[0].item
    expect(product['@id']).toBe('https://nvc-home4you.eu/bg/ceni#product-gal-13')
    expect(product.url).toBe('https://nvc-home4you.eu/bg/ceni#item-13')
  })

  it('leaves out a product without a price, image or description, and renders nothing for none', () => {
    expect(ld([{ ...container6x3, price: 0 }])).toBeNull()
    expect(ld([{ ...container6x3, image: '' }])).toBeNull()
    expect(ld([{ ...container6x3, description: ' ' }])).toBeNull()
    expect(ld([])).toBeNull()
  })

  it('keeps an absolute image as it is', () => {
    const product = ld([{ ...container6x3, image: 'https://cdn.example.org/a.webp' }]).itemListElement[0].item
    expect(product.image).toEqual(['https://cdn.example.org/a.webp'])
  })

  it("names the site's Organization as the seller, by the @id index.html gives it", () => {
    const product = ld([container6x3]).itemListElement[0].item
    expect(product.offers.seller).toMatchObject({ '@type': 'Organization', '@id': ORGANIZATION_ID, name: 'NVC Home4You' })
  })
})

// The steel page's markup: a service with no price, provided by the Organization that
// index.html publishes on every page. The @id is how the two become one entity, so it has to
// be the very string index.html carries.
describe('ServiceJSONLD', () => {
  function service(props) {
    const { container } = render(<ServiceJSONLD {...props} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    return script ? JSON.parse(script.textContent) : null
  }

  const props = {
    name: 'Сглобяеми къщи със стоманена конструкция по проект',
    serviceType: 'Проектиране и изграждане на сглобяеми къщи със стоманена конструкция',
    description: 'Сглобяеми къщи със стоманена конструкция по вашия проект.',
    url: '/bg/sglobqemi-kyshti',
    image: 'https://nvc-home4you.eu/api/img/content/bvk4n834b-rcn-eg-vb.webp',
  }

  it('is a Service with absolute urls, the area served and no offer', () => {
    const data = service(props)
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': 'https://nvc-home4you.eu/bg/sglobqemi-kyshti#service',
      name: props.name,
      serviceType: props.serviceType,
      description: props.description,
      url: 'https://nvc-home4you.eu/bg/sglobqemi-kyshti',
      image: [props.image],
      areaServed: ['BG', 'EU'],
    })
    expect(data.offers).toBeUndefined()
    expect(JSON.stringify(data)).not.toMatch(/price|aggregateRating|FAQ/i)
  })

  it('is provided by the Organization index.html publishes', () => {
    expect(service(props).provider).toEqual({
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'NVC Home4You',
      url: 'https://nvc-home4you.eu/',
    })

    const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8')
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
    const organization = blocks.find((block) => block['@type'] === 'Organization')
    expect(organization['@id']).toBe(ORGANIZATION_ID)
  })

  it('renders nothing without a name or a url', () => {
    expect(service({ ...props, name: '' })).toBeNull()
    expect(service({ ...props, url: '' })).toBeNull()
  })
})
