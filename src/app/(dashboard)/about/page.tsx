import type { Metadata } from 'next'

import { PageContainer } from '@/components/layout/page-container'

export const metadata: Metadata = {
  title: 'About | Markerbook',
}

// Where people get the source of the version they use (AGPL section 13).
// Self-hosters who change the code point this at their own repository.
const SOURCE_URL =
  process.env.NEXT_PUBLIC_SOURCE_URL || 'https://github.com/nevilhulspas/markerbook'

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {children}
    </a>
  )
}

export default function AboutPage() {
  return (
    <PageContainer width="narrow" className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">About Markerbook</h1>
        <p className="text-muted-foreground">
          A tool to organise your own lab results, body measurements and food log.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Not medical advice</h2>
        <p className="text-sm text-muted-foreground">
          Markerbook is not a medical device and it does not give medical advice. AI output can be
          wrong. Talk to your doctor before you change treatment, medication or supplements.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Licence and source code</h2>
        <p className="text-sm text-muted-foreground">
          Markerbook is free software under the GNU Affero General Public License v3.0 or later. The
          source code of this version is at <ExternalLink href={SOURCE_URL}>{SOURCE_URL}</ExternalLink>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Data sources</h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">LOINC (lab test codes)</p>
          <p>
            This material contains content from LOINC (
            <ExternalLink href="http://loinc.org">http://loinc.org</ExternalLink>). LOINC is copyright ©
            Regenstrief Institute, Inc. and the Logical Observation Identifiers Names and Codes (LOINC)
            Committee and is available at no cost under the license at{' '}
            <ExternalLink href="http://loinc.org/license">http://loinc.org/license</ExternalLink>. LOINC®
            is a registered United States trademark of Regenstrief Institute, Inc.
          </p>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Molar masses</p>
          <p>
            <ExternalLink href="https://www.ebi.ac.uk/chebi">ChEBI</ExternalLink> (EMBL-EBI, CC BY 4.0)
            and <ExternalLink href="https://pubchem.ncbi.nlm.nih.gov">PubChem</ExternalLink> (NCBI).
          </p>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Food data</p>
          <p>
            NEVO, the Dutch food composition database (
            <ExternalLink href="https://www.rivm.nl/en/dutch-food-composition-database">RIVM</ExternalLink>
            ), and <ExternalLink href="https://world.openfoodfacts.org">Open Food Facts</ExternalLink>{' '}
            (Open Database License 1.0).
          </p>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">DUTCH</p>
          <p>
            &ldquo;DUTCH&rdquo; is a test by Precision Analytical, Inc. Markerbook is not affiliated
            with Precision Analytical.
          </p>
        </div>
      </section>
    </PageContainer>
  )
}
