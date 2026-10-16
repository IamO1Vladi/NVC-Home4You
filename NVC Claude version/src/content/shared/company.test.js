import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WEBSITE_PHONE } from './company.js'

// The automatic confirmation email signs with the website's number (the owner, 2026-10-17).
// The API keeps its own copy of it (EmailService.SignaturePhone, a C# constant), and its .NET
// test types the number again, so nothing there notices if the site's number changes. This
// reads the C# source and checks the copy is the number the site publishes.
const EMAIL_SERVICE = resolve(__dirname, '../../../../api-dotnet/Services/EmailService.cs')

describe('the website phone number', () => {
  it('is the number the API signs the confirmation email with', () => {
    const source = readFileSync(EMAIL_SERVICE, 'utf8')
    expect(source).toContain(`SignaturePhone = "${WEBSITE_PHONE.display}"`)
  })

  it('has a tel: form that is its display form without the spaces', () => {
    expect(WEBSITE_PHONE.tel).toBe(WEBSITE_PHONE.display.replace(/\s/g, ''))
  })
})
