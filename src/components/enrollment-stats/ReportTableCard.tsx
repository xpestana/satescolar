import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ReportTable } from "@/lib/enrollmentStats/reportTables";

interface Props {
  table: ReportTable;
  /** Emphasis for grand totals. */
  variant?: "default" | "total";
}

/** On-screen version of an exported table (same rows as the Excel/PDF). */
export function ReportTableCard({ table, variant = "default" }: Props) {
  return (
    <Card className={cn("overflow-hidden", variant === "total" && "border-primary/50")}>
      <CardHeader className={cn("px-4 py-2", variant === "total" ? "bg-primary/10" : "bg-muted")}>
        <CardTitle className="text-center text-sm font-semibold">{table.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              {table.head.map((label, i) => (
                <TableHead key={label} className={cn("h-8 px-2", i === 0 ? "text-left" : "text-center")}>
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.body.map((cells, r) => (
              <TableRow key={`b${r}`}>
                {cells.map((value, c) => (
                  <TableCell key={c} className={cn("px-2 py-1 tabular-nums", c === 0 ? "text-left" : "text-center")}>
                    {value}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {table.foot.map((cells, r) => (
              <TableRow key={`f${r}`} className={cn("font-semibold", r === 0 && "bg-amber-100/60 dark:bg-amber-500/15")}>
                {cells.map((value, c) => (
                  <TableCell key={c} className={cn("px-2 py-1 tabular-nums", c === 0 ? "text-left" : "text-center")}>
                    {value}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
