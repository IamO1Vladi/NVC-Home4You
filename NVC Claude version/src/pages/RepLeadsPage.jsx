import React from 'react'
import AdminPipelinePage from './AdminPipelinePage.jsx'

// The representatives' panel (ROADMAP #38): the leads pipeline, seen by one person.
//
// A representative signs in with the same Entra account as staff and lands here, on the
// admin pipeline page in its 'rep' scope — the same screen over /api/rep/pipeline, which
// only ever answers about the leads he owns, with the team's controls taken off. The page
// itself knows what differs (AdminPipelinePage's SCOPES); this route component only says
// which scope, so there is one pipeline screen to maintain rather than two.
export default function RepLeadsPage() {
  return <AdminPipelinePage scope="rep" />
}
