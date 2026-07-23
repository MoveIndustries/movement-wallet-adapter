"use client";

import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { truncateAddress } from "./format";
import { TxPayloadSummary } from "./TxPayloadSummary";
import { TxSimulation } from "./TxSimulation";
import type { SimulationState } from "./simulate";

export type TransactionApprovalKind = "sign-and-submit" | "sign";

export interface TransactionApprovalModalProps {
  /** Whether the modal is shown. The parent owns this state. */
  open: boolean;
  /** User approved — proceed to signing. */
  onApprove: () => void;
  /** User rejected, or dismissed via overlay/escape/close. */
  onReject: () => void;
  /**
   * The transaction the dApp asked to sign — the same object passed to
   * `signAndSubmitTransaction` / `signTransaction`. Decoded for display only.
   */
  payload: unknown;
  /** Whether this is a sign-and-submit or sign-only request. Default "sign-and-submit". */
  kind?: TransactionApprovalKind;
  /** Wallet name shown in the header (e.g. "Sign in with existing passkey"). */
  walletName?: string;
  /** Signer address, shown truncated next to the wallet name. */
  address?: string;
  /** Pending state — disables both actions and spins the Approve button. */
  loading?: boolean;
  /** Header title. Default "Approve transaction". */
  title?: string;
  /** Approve button label. Default "Approve". */
  approveLabel?: string;
  /** Reject button label. Default "Reject". */
  rejectLabel?: string;
  /** Optional icon rendered above the title (e.g. a passkey fingerprint). */
  icon?: React.ReactNode;
  /** Optional simulation outcome shown below the decoded payload. */
  simulation?: SimulationState;
}

/**
 * Transaction-approval modal — shows a decoded summary of `payload` and reports
 * the user's Approve/Reject decision via callbacks. Purely presentational; the
 * host app owns open/approve/reject state (see TransactionApprovalProvider).
 *
 * A local counterpart to the canonical TransactionApprovalModal in
 * @moveindustries/movement-design-system — same API, styled with this app's
 * shadcn tokens.
 */
export function TransactionApprovalModal({
  open,
  onApprove,
  onReject,
  payload,
  kind = "sign-and-submit",
  walletName,
  address,
  loading = false,
  title = "Approve transaction",
  approveLabel = "Approve",
  rejectLabel = "Reject",
  icon,
  simulation,
}: TransactionApprovalModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onReject();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center sm:text-center">
          {icon && (
            <div className="mb-1 flex h-10 w-10 items-center justify-center text-primary">
              {icon}
            </div>
          )}
          <DialogTitle>{title}</DialogTitle>
          {(walletName || address) && (
            <DialogDescription className="flex max-w-full items-center justify-center gap-2 truncate">
              {walletName && <span className="truncate">{walletName}</span>}
              {walletName && address && <span aria-hidden>·</span>}
              {address && (
                <span className="font-mono text-xs" title={address}>
                  {truncateAddress(address)}
                </span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {payload !== undefined && (
          <TxPayloadSummary payload={payload} kind={kind} />
        )}

        {simulation && (
          <div className="border-t border-border pt-3">
            <TxSimulation state={simulation} />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onReject}
            disabled={loading}
          >
            {rejectLabel}
          </Button>
          <Button className="flex-1" onClick={onApprove} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving
              </>
            ) : (
              approveLabel
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
