import type { ReactNode } from "react";

export function Table({
  head,
  children,
  hidden = false,
}: {
  head: ReactNode;
  children: ReactNode;
  hidden?: boolean;
}) {
  return (
    <div className="foundations__table-wrap" hidden={hidden}>
      <table className="foundations__table">
        {head}
        {children}
      </table>
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="foundations__empty">
        {children}
      </td>
    </tr>
  );
}

