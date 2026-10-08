import React from 'react'

// The honeypot on every public enquiry form (ROADMAP #38: the rep link turns each enquiry
// into a lead the moment it arrives, which makes a flood of junk enquiries a flood of junk
// leads). A field called "website" that no human can see; a form-filling bot fills every
// field it finds, and the server quietly drops a request where this one is non-blank
// while still answering as if it had sent.
//
// Off-screen rather than display:none or type=hidden on purpose: the better bots skip
// fields the browser would not render. aria-hidden and tabIndex -1 keep it out of screen
// readers and the tab order, and autoComplete=off keeps a browser from filling it in for a
// real visitor, which would make them look like the bot.
export default function HoneypotField() {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 0, overflow: 'hidden' }}
    >
      <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  )
}
