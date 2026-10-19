import type { jsPDF } from 'jspdf'

/**
 * Where the last `autoTable(doc, …)` ended. jspdf-autotable sets
 * `doc.lastAutoTable` at runtime but ships no type for it.
 */
export function lastAutoTableFinalY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}
