import { formatCurrency } from "@/lib/utils";

export function WalletAmount({ amount, className }: { amount: number; className?: string }) {
  return (
    <span className={className}>
      ৳&nbsp;{formatCurrency(amount)}
    </span>
  );
}
