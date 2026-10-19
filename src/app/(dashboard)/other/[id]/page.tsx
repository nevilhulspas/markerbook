import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'

import { getOtherTest, getOtherTestSourceUrl } from '@/actions/other-tests'
import { APP_LOCALE } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OtherOutcomeBadge } from '@/components/other/other-outcome-badge'
import { OtherDeleteButton } from '@/components/other/other-delete-button'
import { OtherInterpretPanel } from '@/components/other/other-interpret-panel'
import { OtherPdfPanel } from '@/components/other/other-pdf-panel'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export default async function OtherTestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const test = await getOtherTest(id)
  if (!test) return notFoundOrAuthOutage()

  const hasPdf = !!test.pdf_storage_path
  const sourceUrl = test.pdf_storage_path
    ? (await getOtherTestSourceUrl(test.pdf_storage_path)).url
    : null

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/other">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{test.test_name}</h1>
            <p className="text-muted-foreground">
              {new Date(test.test_date).toLocaleDateString(APP_LOCALE, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {test.provider ? ` · ${test.provider}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/other/${test.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <OtherDeleteButton testId={test.id} />
        </div>
      </div>

      {/* Content first in the DOM so it stacks on top on mobile; on lg the row
          reverses so the PDF viewer sits in a sticky panel on the LEFT (like
          the blood-test layout) with the result/readings/interpretation right. */}
      <div className="flex flex-col gap-6 lg:flex-row-reverse">
        <div
          className={cn('w-full min-w-0 space-y-6', hasPdf ? 'lg:w-[60%]' : 'lg:max-w-4xl')}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <OtherOutcomeBadge outcome={test.outcome} />
              {test.result_summary && <p className="text-sm">{test.result_summary}</p>}
            </CardContent>
          </Card>

          {test.values.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Readings</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reading</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Flag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {test.values.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.label}</TableCell>
                        <TableCell className="tabular-nums">
                          {v.value ?? '—'}
                          {v.unit ? ` ${v.unit}` : ''}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{v.flag ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {test.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm">{test.notes}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interpretation</CardTitle>
            </CardHeader>
            <CardContent>
              <OtherInterpretPanel testId={test.id} initialContent={test.interpretation} />
            </CardContent>
          </Card>
        </div>

        {hasPdf && (
          <div className="w-full min-w-0 lg:sticky lg:top-4 lg:w-[40%] lg:self-start">
            {sourceUrl ? (
              <OtherPdfPanel url={sourceUrl} />
            ) : (
              <div className="flex min-h-[300px] items-center justify-center rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                The stored file couldn’t be loaded right now.
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Interpretations are AI-generated and not medical advice. Consult your healthcare
        provider for diagnosis and treatment.
      </p>
    </PageContainer>
  )
}
