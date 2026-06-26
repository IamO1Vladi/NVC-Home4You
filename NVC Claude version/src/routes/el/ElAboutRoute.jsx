// src/routes/el/ElAboutRoute.jsx
import SEO from '../../components/SEO.jsx'
import AboutPage from '../../pages/AboutPage.jsx'
import elContent from '../../content/el/about.js'

export default function ElAboutRoute() {
  return (
    <>
        <SEO
        title="Σχετικά με Εμάς | NVC Home4You"
        description="Μάθετε για την NVC Home4You — την ομάδα μας, τη μαστοριά μας και την προσέγγισή μας στη δομική και προκατασκευασμένη κατασκευή σε όλη την ΕΕ."
        url="https://nvc-home4you.eu/el/sxetika-me-emas"
        canonical="https://nvc-home4you.eu/el/sxetika-me-emas"
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/about' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/za-nas' },
          { hrefLang: 'el', href: 'https://nvc-home4you.eu/el/sxetika-me-emas' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/about' },
        ]}
      />
      <AboutPage locale="el" content={elContent} />
    </>
  )
}
