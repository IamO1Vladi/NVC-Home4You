import React from 'react'

export default function ServicesPage({ content }) {
  if (!content) return null

  return (
    <main>
      <section>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(28px,4vw,40px)', margin: 0 }}>{content.heading}</h1>
          <p className="mt-2" style={{ opacity: 0.85 }}>{content.subheading}</p>
          <div className="grid cols-2 md-cols-3 mt-6">
            {content.categories.map((cat) => (
              <div className="card p-6" key={cat.title}>
                <div className="mb-2" style={{ fontWeight: 700 }}><span className="grad-text">{cat.title}</span></div>
                <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9 }}>
                  {cat.items.map((item) => (
                    <li className="mt-2" key={item.title}><strong>{item.title}</strong> - {item.desc}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
