import Link from "next/link";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@daromsart/ui";
import type { SignableDocumentRow } from "@/modules/signable-documents/queries";

function formatDateLong(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function SignableDocumentsList({ documents }: { documents: SignableDocumentRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Document</TableHead>
          <TableHead>Pages</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Importé le</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell>
              <Link href={`/signatures/${doc.id}`} className="font-medium hover:underline">
                {doc.title}
              </Link>
            </TableCell>
            <TableCell>{doc.pageCount}</TableCell>
            <TableCell>
              {doc.signedAt ? (
                <Badge variant="success">Signé</Badge>
              ) : (
                <Badge variant="info">En attente</Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateLong(doc.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
