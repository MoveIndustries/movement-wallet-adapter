import { Loader2 } from "lucide-react";
import { formatOctas } from "./format";
import type { SimulationState } from "./simulate";

/**
 * Renders the outcome of simulating the transaction against the node — the
 * closest thing to "exactly what this will do", especially for opaque scripts.
 */
export function TxSimulation({ state }: { state: SimulationState }) {
  if (state.status === "loading") {
    return (
      <Row>
        <span className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Simulating…
        </span>
      </Row>
    );
  }

  if (state.status === "unsupported") {
    return (
      <Row>
        <span className="text-muted-foreground">Simulation</span>
        <span className="text-right text-muted-foreground">{state.reason}</span>
      </Row>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Simulation</span>
          <span className="text-right text-muted-foreground">
            Couldn&apos;t simulate
          </span>
        </div>
        <p className="text-xs text-red-500 break-words">{state.message}</p>
      </div>
    );
  }

  // done
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Simulated result</span>
        <span className={state.success ? "text-green-500" : "text-red-500"}>
          {state.success ? "Will succeed" : "Will fail"}
        </span>
      </div>
      {!state.success && (
        <p className="text-xs text-red-500 break-words" title={state.vmStatus}>
          {state.vmStatus}
        </p>
      )}
      <div className="flex items-baseline justify-between gap-3 px-1 text-sm">
        <span className="text-muted-foreground">Network fee (est.)</span>
        <span className="font-mono text-xs">{formatOctas(state.feeOctas)} MOVE</span>
      </div>
      <div className="flex flex-col gap-1 px-1 text-sm">
        <span className="text-muted-foreground">Effects</span>
        {state.events.length === 0 ? (
          <span className="text-xs text-muted-foreground">No state changes</span>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {state.events.map((e, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs">{e.type}</span>
                {e.amount != null && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {e.amount}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      {children}
    </div>
  );
}
