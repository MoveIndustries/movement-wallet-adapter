"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  TransactionApprovalModal,
  type TransactionApprovalKind,
} from "./TransactionApprovalModal";
import type { SimulationResult, SimulationState } from "./simulate";

interface RequestMeta {
  walletName?: string;
  address?: string;
  icon?: ReactNode;
  /** Optional thunk that simulates this transaction and returns its effects. */
  simulate?: () => Promise<SimulationResult>;
}

interface PendingRequest extends RequestMeta {
  id: number;
  kind: TransactionApprovalKind;
  payload: unknown;
  resolve: (approved: boolean) => void;
}

interface TransactionApprovalContextValue {
  /**
   * Open the approval modal for a transaction and resolve once the user
   * decides. `true` = approved (proceed to sign), `false` = rejected/dismissed.
   * Concurrent requests queue and are shown one at a time.
   */
  request: (
    kind: TransactionApprovalKind,
    payload: unknown,
    meta?: RequestMeta,
  ) => Promise<boolean>;
}

const TransactionApprovalContext =
  createContext<TransactionApprovalContextValue | null>(null);

export function TransactionApprovalProvider({ children }: PropsWithChildren) {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  // Mirror of `pending` for synchronous reads inside event callbacks, so state
  // transitions stay pure (no side effects in setState updaters, which React
  // Strict Mode double-invokes in dev).
  const pendingRef = useRef<PendingRequest | null>(null);
  const queueRef = useRef<PendingRequest[]>([]);
  const idRef = useRef(0);
  // Last shown request, retained so the modal keeps its content while it plays
  // its close animation (otherwise it briefly renders an empty shell).
  const lastShownRef = useRef<PendingRequest | null>(null);

  const show = useCallback((req: PendingRequest | null) => {
    pendingRef.current = req;
    if (req) lastShownRef.current = req;
    setPending(req);
  }, []);

  const request = useCallback<TransactionApprovalContextValue["request"]>(
    (kind, payload, meta = {}) =>
      new Promise<boolean>((resolve) => {
        const req: PendingRequest = {
          id: ++idRef.current,
          kind,
          payload,
          resolve,
          ...meta,
        };
        // Show immediately if idle; otherwise queue behind the open one.
        if (pendingRef.current) queueRef.current.push(req);
        else show(req);
      }),
    [show],
  );

  const settle = useCallback(
    (approved: boolean) => {
      const current = pendingRef.current;
      if (!current) return;
      current.resolve(approved);
      show(queueRef.current.shift() ?? null);
    },
    [show],
  );

  const approve = useCallback(() => settle(true), [settle]);
  const reject = useCallback(() => settle(false), [settle]);

  // Run the simulation for each newly-shown request. Keyed on request id so it
  // runs once per request; the last result is retained while the modal closes.
  const [simState, setSimState] = useState<SimulationState | null>(null);
  useEffect(() => {
    if (!pending) return; // closing — keep the last result during the animation
    if (!pending.simulate) {
      setSimState(null);
      return;
    }
    let cancelled = false;
    setSimState({ status: "loading" });
    pending
      .simulate()
      .then((res) => !cancelled && setSimState(res))
      .catch(
        (e) =>
          !cancelled &&
          setSimState({
            status: "error",
            message: e instanceof Error ? e.message : String(e),
          }),
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.id]);

  const shown = pending ?? lastShownRef.current;

  return (
    <TransactionApprovalContext.Provider value={{ request }}>
      {children}
      <TransactionApprovalModal
        open={pending !== null}
        onApprove={approve}
        onReject={reject}
        payload={shown?.payload}
        kind={shown?.kind ?? "sign-and-submit"}
        walletName={shown?.walletName}
        address={shown?.address}
        icon={shown?.icon}
        simulation={simState ?? undefined}
      />
    </TransactionApprovalContext.Provider>
  );
}

export function useTransactionApproval(): TransactionApprovalContextValue {
  const ctx = useContext(TransactionApprovalContext);
  if (!ctx) {
    throw new Error(
      "useTransactionApproval must be used within a TransactionApprovalProvider",
    );
  }
  return ctx;
}
